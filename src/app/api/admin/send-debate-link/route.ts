// src/app/api/admin/send-debate-link/route.ts
import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';
import jwt              from 'jsonwebtoken';
import { cookies }      from 'next/headers';
import pLimit           from 'p-limit';
import sgMail           from '@sendgrid/mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Environment Variables
const JWT_SECRET = process.env.JWT_SECRET!;
const ZOOM_LINK  = process.env.ZOOM_LINK!;
const sendgridApiKey = process.env.SENDGRID_API_KEY;
// Default to 9s for safety if timeout env var isn't set, Netlify standard API routes are often 10s.
// For longer, you need background functions or specific plan configurations.
const NETLIFY_FUNCTION_TIMEOUT_SECONDS = parseInt(process.env.NETLIFY_FUNCTION_TIMEOUT_SECONDS || "9", 10);

// This should be your SendGrid verified single sender email address
const VERIFIED_SENDER_EMAIL = 'iecppsu85@gmail.com'; // Make sure this matches your verified sender

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
    } catch (error) {
        let errorMessage = "An unknown error occurred configuring @sendgrid/mail.";
        if (error instanceof Error) {
            errorMessage = `Error configuring @sendgrid/mail: ${error.message}`;
        } else if (typeof error === 'string') {
            errorMessage = `Error configuring @sendgrid/mail: ${error}`;
        }
        sendgridInitializationError = errorMessage;
        console.error(sendgridInitializationError, error);
    }
}

export async function POST() {
    const invocationStartTime = Date.now();
    console.log(`Function invocation started at: ${new Date(invocationStartTime).toISOString()}`);

    if (sendgridInitializationError || !sendgridInitialized) {
        const errorMsg = sendgridInitializationError || "SendGrid mail client not initialized (unexpected state).";
        console.error("Responding with 500 due to SendGrid client initialization error:", errorMsg);
        return NextResponse.json({ error: `Mail client not initialized: ${errorMsg}` }, { status: 500 });
    }

    const token = cookies().get('admin_token');
    if (!token) {
        console.log("Unauthorized: No admin token found.");
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); // Ensures exit if token is not found
    }

    try {
        jwt.verify(token.value, JWT_SECRET); // 'token.value' is safe here
    } catch (jwtError) {
        let message = "Invalid token";
        if (jwtError instanceof Error) {
            message = `Invalid token: ${jwtError.message}`;
        }
        console.log(message, jwtError);
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 }); // Ensures exit on invalid token
    }

    if (!ZOOM_LINK) {
        console.error("ZOOM_LINK environment variable is not set.");
        return NextResponse.json({ error: 'Server configuration error: Missing Zoom link.' }, { status: 500 });
    }

    console.log("Fetching all voters...");
    const allVoters = await prisma.voter.findMany({
        select: { email: true, fullName: true },
        // orderBy: { id: 'asc' } // Optional: Add consistent ordering
    });

    if (allVoters.length === 0) {
        console.log("No voters found in the database.");
        return NextResponse.json({ message: "No voters found to send emails to.", failures: [], totalAttempted: 0, totalSuccess: 0 }, { status: 200 });
    }
    console.log(`Found ${allVoters.length} voters in total.`);

    // Aggressive Configuration for SendGrid
    const SUB_BATCH_SIZE = 15;
    const DELAY_BETWEEN_SUB_BATCHES_MS = 100;
    const CONCURRENT_SEND_LIMIT = 10;

    const emailLimiter = pLimit(CONCURRENT_SEND_LIMIT);
    let totalSuccess = 0;
    const overallFailures: { email: string; message: string; reason?: string }[] = [];
    let votersProcessed = 0;

    for (let i = 0; i < allVoters.length; i += SUB_BATCH_SIZE) {
        const elapsedTimeSeconds = (Date.now() - invocationStartTime) / 1000;
        if (elapsedTimeSeconds > NETLIFY_FUNCTION_TIMEOUT_SECONDS - 2) { // 2-second buffer
            console.warn(`Approaching timeout (${elapsedTimeSeconds.toFixed(1)}s / ${NETLIFY_FUNCTION_TIMEOUT_SECONDS}s). Stopping email processing to allow graceful exit.`);
            break;
        }

        const subBatch = allVoters.slice(i, i + SUB_BATCH_SIZE);
        console.log(`Processing sub-batch ${Math.floor(i / SUB_BATCH_SIZE) + 1} of ${Math.ceil(allVoters.length / SUB_BATCH_SIZE)}: ${subBatch.length} voters.`);

        const emailPromises = subBatch.map(voter =>
            emailLimiter(async () => {
                const msg = {
                    to: voter.email,
                    from: {
                        email: VERIFIED_SENDER_EMAIL,
                        name: "IEC Voting"
                    },
                    subject: 'Live Debate Link - May 23, 2025',
                    text: `Hello ${voter.fullName},\n\nOur live online debate is scheduled for tomorrow, May 23, 2025, at 2:00 PM.\n\nJoin the debate using this link:\n${ZOOM_LINK}\n\nWe look forward to your participation.\n\n—IEC Team`
                };
                try {
                    await sgMail.send(msg);
                    // console.log(`Email sent successfully to: ${voter.email}`); // Keep logging minimal in loop for speed
                    return { status: 'fulfilled' as const, email: voter.email };
                } catch (sendError) {
                    const err = sendError as Error & { response?: { body?: { errors?: {message: string}[] } } };
                    let detailedMessage = err.message;
                    if (err.response && err.response.body && err.response.body.errors && err.response.body.errors.length > 0) {
                        detailedMessage = err.response.body.errors.map(e => e.message).join(', ');
                    }
                    console.error(`Failed to send email to: ${voter.email}, Reason: ${detailedMessage}`, err.response?.body || err);
                    return { status: 'rejected' as const, email: voter.email, message: detailedMessage, reason: err.toString() };
                }
            })
        );

        const results = await Promise.all(emailPromises);
        results.forEach(r => {
            if (r.status === 'fulfilled') {
                totalSuccess++;
            } else {
                // Type assertion needed if 'r' could be 'fulfilled' type after filtering
                overallFailures.push(r as { email: string; message: string; reason?: string; status: 'rejected' });
            }
        });
        votersProcessed += subBatch.length;

        console.log(`Sub-batch ${Math.floor(i / SUB_BATCH_SIZE) + 1} processed. Total sent so far: ${totalSuccess}/${votersProcessed}. Cumulative failures: ${overallFailures.length}.`);

        if (i + SUB_BATCH_SIZE < allVoters.length && DELAY_BETWEEN_SUB_BATCHES_MS > 0) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_SUB_BATCHES_MS));
        }
    }

    const finalMessage = `Processing finished. Attempted ${votersProcessed} of ${allVoters.length} voters. Total successful emails: ${totalSuccess}. Total failures: ${overallFailures.length}.`;
    console.log(finalMessage);
    if (overallFailures.length > 0) {
        console.error("Overall Failures (SendGrid):", JSON.stringify(overallFailures.map(f => ({email: f.email, message: f.message})), null, 2));
    }

    const durationMs = Date.now() - invocationStartTime;
    console.log(`Function invocation took approximately ${durationMs / 1000} seconds.`);
    console.log(`Function invocation ended at: ${new Date().toISOString()}`);

    const allTargetedProcessed = votersProcessed === allVoters.length;
    let statusCode = 200;

    if (!allTargetedProcessed && totalSuccess < allVoters.length && votersProcessed > 0) {
        statusCode = 206; // Partial Content because loop was broken by timeout check
    } else if (overallFailures.length > 0 && totalSuccess < votersProcessed) {
        statusCode = 207; // Multi-Status (some sent, some failed within the processed batch)
    } else if (totalSuccess === 0 && votersProcessed > 0) {
        statusCode = 502; // All attempted in processed batch failed
    } else if (allVoters.length === 0) {
        statusCode = 200; // No voters to process
    } else if (totalSuccess === votersProcessed && votersProcessed === allVoters.length) {
        statusCode = 200; // All successfully processed
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
