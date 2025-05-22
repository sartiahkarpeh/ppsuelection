// src/app/api/admin/send-debate-link/route.ts
import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';
import jwt              from 'jsonwebtoken';
import { cookies }      from 'next/headers';
import pLimit           from 'p-limit';
import sgMail           from '@sendgrid/mail'; // Import @sendgrid/mail

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const functionStartTime = Date.now(); // Track start time for approximate duration check

// Environment Variables
const JWT_SECRET = process.env.JWT_SECRET!;
const ZOOM_LINK  = process.env.ZOOM_LINK!;
const sendgridApiKey = process.env.SENDGRID_API_KEY;
const NETLIFY_FUNCTION_TIMEOUT_SECONDS = parseInt(process.env.NETLIFY_FUNCTION_TIMEOUT_SECONDS || "9", 10); // Assume 9s to be safe, or set env var

const VERIFIED_SENDER_EMAIL = 'iecppsu85@gmail.com';

let sendgridInitialized = false;
let sendgridInitializationError: string | null = null;

if (!sendgridApiKey) {
    sendgridInitializationError = "CRITICAL: SENDGRID_API_KEY environment variable is missing!";
    console.error(sendgridInitializationError);
} else if (!VERIFIED_SENDER_EMAIL) {
    sendgridInitializationError = "CRITICAL: VERIFIED_SENDER_EMAIL is not set in the code!";
    console.error(sendgridInitializationError);
} else {
    try {
        sgMail.setApiKey(sendgridApiKey);
        sendgridInitialized = true;
        console.log('@sendgrid/mail configured with API key.');
    } catch (error) { /* ... (same error handling as before) ... */ }
}

export async function POST() {
    const invocationStartTime = Date.now();
    console.log(`Function invocation started at: ${new Date(invocationStartTime).toISOString()}`);

    if (sendgridInitializationError || !sendgridInitialized) { /* ... (same error handling) ... */ }

    const token = cookies().get('admin_token');
    if (!token) { /* ... (auth logic) ... */ }
    try { jwt.verify(token.value, JWT_SECRET); }
    catch (jwtError) { /* ... (auth logic) ... */ }

    if (!ZOOM_LINK) { /* ... (config check) ... */ }

    console.log("Fetching all voters...");
    const allVoters = await prisma.voter.findMany({
        select: { email: true, fullName: true } // Consider adding an orderBy clause for consistency
        // orderBy: { id: 'asc' } // Example: if you have an auto-incrementing ID
    });

    if (allVoters.length === 0) { /* ... (no voters logic) ... */ }
    console.log(`Found ${allVoters.length} voters in total.`);

    // Aggressive Configuration for SendGrid - try to complete within ~9-10 seconds
    const SUB_BATCH_SIZE = 15; // Smaller sub-batches, more loops, but each loop is faster
    const DELAY_BETWEEN_SUB_BATCHES_MS = 100; // Very short delay, almost negligible
    const CONCURRENT_SEND_LIMIT = 10;     // Higher concurrency for SendGrid API calls

    const emailLimiter = pLimit(CONCURRENT_SEND_LIMIT);
    let totalSuccess = 0;
    const overallFailures: { email: string; message: string; reason?: string }[] = [];
    let votersProcessed = 0;

    for (let i = 0; i < allVoters.length; i += SUB_BATCH_SIZE) {
        // Check elapsed time - simple check
        const elapsedTimeSeconds = (Date.now() - invocationStartTime) / 1000;
        if (elapsedTimeSeconds > NETLIFY_FUNCTION_TIMEOUT_SECONDS - 2) { // Leave 2s buffer
            console.warn(`Approaching timeout (${elapsedTimeSeconds}s / ${NETLIFY_FUNCTION_TIMEOUT_SECONDS}s). Stopping email processing to allow graceful exit.`);
            break; // Exit the loop
        }

        const subBatch = allVoters.slice(i, i + SUB_BATCH_SIZE);
        console.log(`Processing sub-batch ${Math.floor(i / SUB_BATCH_SIZE) + 1} of ${Math.ceil(allVoters.length / SUB_BATCH_SIZE)}: ${subBatch.length} voters.`);

        const emailPromises = subBatch.map(voter =>
            emailLimiter(async () => {
                // No individual delay here, rely on pLimit and fast SendGrid API
                const msg = { /* ... (same msg object as before, using VERIFIED_SENDER_EMAIL and ZOOM_LINK) ... */ };
                msg.to = voter.email;
                msg.from = { email: VERIFIED_SENDER_EMAIL, name: "IEC Voting" };
                msg.subject = 'Live Debate Link - May 23, 2025';
                msg.text = `Hello ${voter.fullName},\n\nOur live online debate is scheduled for tomorrow, May 23, 2025, at 2:00 PM.\n\nJoin the debate using this link:\n${ZOOM_LINK}\n\nWe look forward to your participation.\n\n—IEC Team`;

                try {
                    await sgMail.send(msg);
                    // console.log(`Email sent successfully to: ${voter.email}`); // Reduce verbose logging for speed
                    return { status: 'fulfilled' as const, email: voter.email };
                } catch (sendError) { /* ... (same detailed error handling as before) ... */ }
            })
        );

        const results = await Promise.all(emailPromises);
        results.forEach(r => { if (r.status === 'fulfilled') totalSuccess++; else overallFailures.push(r as any); });
        votersProcessed += subBatch.length;

        console.log(`Sub-batch ${Math.floor(i / SUB_BATCH_SIZE) + 1} processed. Total sent so far: ${totalSuccess}/${votersProcessed}. Cumulative failures: ${overallFailures.length}.`);

        if (i + SUB_BATCH_SIZE < allVoters.length && DELAY_BETWEEN_SUB_BATCHES_MS > 0) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_SUB_BATCHES_MS));
        }
    }

    const finalMessage = `Processing finished. Attempted ${votersProcessed} of ${allVoters.length} voters. Total successful emails: ${totalSuccess}. Total failures: ${overallFailures.length}.`;
    console.log(finalMessage);
    if (overallFailures.length > 0) { /* ... (log simplified failures) ... */ }

    const durationMs = Date.now() - invocationStartTime;
    console.log(`Function invocation took approximately ${durationMs / 1000} seconds.`);
    console.log(`Function invocation ended at: ${new Date().toISOString()}`);

    // Determine status code based on whether all targeted voters were processed
    const allTargetedProcessed = votersProcessed === allVoters.length;
    let statusCode = 200;
    if (!allTargetedProcessed && totalSuccess < allVoters.length) { // Didn't finish processing all, and not all were successful
        statusCode = 206; // Partial Content
    } else if (overallFailures.length > 0) {
        statusCode = 207; // Multi-Status
    } else if (totalSuccess === 0 && allVoters.length > 0) {
        statusCode = 502; // Bad Gateway / All failed
    }


    return NextResponse.json({
        message: finalMessage,
        totalVoters: allVoters.length,
        votersAttemptedInThisRun: votersProcessed,
        totalSuccessInThisRun: totalSuccess,
        totalFailuresInThisRun: overallFailures.length,
        failures: overallFailures.map(f => ({email: f.email, message: f.message}))
    }, { status: statusCode });
}
