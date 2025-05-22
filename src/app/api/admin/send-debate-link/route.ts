// src/app/api/admin/send-debate-link/route.ts
import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';
import jwt              from 'jsonwebtoken';
import { cookies }      from 'next/headers';
import nodemailer       from 'nodemailer';
import pLimit           from 'p-limit';
import * as nodemailerSendgrid from 'nodemailer-sendgrid'; // Import SendGrid transport

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Environment Variables
const JWT_SECRET = process.env.JWT_SECRET!;
const ZOOM_LINK  = process.env.ZOOM_LINK!;
const sendgridApiKey = process.env.SENDGRID_API_KEY;

// This should be your SendGrid verified single sender email address
const VERIFIED_SENDER_EMAIL = 'iecppsu85@gmail.com';

let moduleTransporter: nodemailer.Transporter | null = null;
let moduleTransporterInitializationError: string | null = null;

if (!sendgridApiKey) {
    moduleTransporterInitializationError = "CRITICAL: SENDGRID_API_KEY environment variable is missing!";
    console.error(moduleTransporterInitializationError);
} else if (!VERIFIED_SENDER_EMAIL) {
    moduleTransporterInitializationError = "CRITICAL: VERIFIED_SENDER_EMAIL is not set in the code!";
    console.error(moduleTransporterInitializationError);
}
 else {
    try {
        moduleTransporter = nodemailer.createTransport(
            nodemailerSendgrid({ // Use SendGrid transport
                apiKey: sendgridApiKey
            })
        );
        // Optional: Verify. SendGrid transport might not strictly need explicit verify like SMTP.
        // For now, we'll assume it's okay if the API key is present.
        // If you want to verify:
        /*
        moduleTransporter.verify().then(() => {
            console.log('SendGrid Connection Verified Successfully at module load.');
        }).catch(err => {
            let verifyErrorMessage = "Unknown SendGrid verification error";
            if (err instanceof Error) {
                verifyErrorMessage = err.message;
            } else if (typeof err === 'string') {
                verifyErrorMessage = err;
            }
            console.error(`SendGrid verification at module load failed: ${verifyErrorMessage}`, err);
            // Note: Even if verify fails here, sendMail might still work if API key is valid.
        });
        */
       console.log('SendGrid transporter configured.');

    } catch (error) {
        let errorMessage = "An unknown error occurred creating SendGrid transporter.";
        if (error instanceof Error) {
            errorMessage = `Error creating SendGrid transporter: ${error.message}`;
        } else if (typeof error === 'string') {
            errorMessage = `Error creating SendGrid transporter: ${error}`;
        }
        moduleTransporterInitializationError = errorMessage;
        console.error(moduleTransporterInitializationError, error);
        moduleTransporter = null;
    }
}

export async function POST() {
    console.log(`Function invocation started at: ${new Date().toISOString()}`);

    if (moduleTransporterInitializationError) {
        console.error("Responding with 500 due to transporter initialization error:", moduleTransporterInitializationError);
        return NextResponse.json({ error: `Transporter not initialized: ${moduleTransporterInitializationError}` }, { status: 500 });
    }
    if (!moduleTransporter) {
        console.error("Responding with 500 because transporter is not available (unexpected state).");
        return NextResponse.json({ error: "Transporter is not available (unexpected state)." }, { status: 500 });
    }
    const transporter = moduleTransporter;

    const token = cookies().get('admin_token');
    if (!token) {
        console.log("Unauthorized: No admin token found.");
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        jwt.verify(token.value, JWT_SECRET);
    } catch (jwtError) {
        let message = "Invalid token";
        if (jwtError instanceof Error) {
            message = `Invalid token: ${jwtError.message}`;
        }
        console.log(message, jwtError);
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!ZOOM_LINK) {
        console.error("ZOOM_LINK environment variable is not set.");
        return NextResponse.json({ error: 'Server configuration error: Missing Zoom link.' }, { status: 500 });
    }

    console.log("Fetching all voters...");
    const allVoters = await prisma.voter.findMany({
        select: { email: true, fullName: true }
    });

    if (allVoters.length === 0) {
        console.log("No voters found in the database.");
        return NextResponse.json({ message: "No voters found to send emails to.", failures: [], totalAttempted: 0, totalSuccess: 0 }, { status: 200 });
    }
    console.log(`Found ${allVoters.length} voters in total.`);

    // Configuration for sending with SendGrid - can be more generous than Gmail
    // but still mindful of Netlify's typical ~10s timeout for synchronous functions.
    const SUB_BATCH_SIZE = 20; // Number of emails to process in each internal sub-batch
    const DELAY_BETWEEN_SUB_BATCHES_MS = 500; // 0.5 seconds delay between sub-batches
    const CONCURRENT_SEND_LIMIT = 8;      // SendGrid can handle more concurrency

    const emailLimiter = pLimit(CONCURRENT_SEND_LIMIT);
    let totalSuccess = 0;
    const overallFailures: { email: string; message: string; reason?: string }[] = [];
    let votersProcessed = 0;

    for (let i = 0; i < allVoters.length; i += SUB_BATCH_SIZE) {
        const subBatch = allVoters.slice(i, i + SUB_BATCH_SIZE);
        console.log(`Processing sub-batch ${Math.floor(i / SUB_BATCH_SIZE) + 1}: ${subBatch.length} voters (starting with ${subBatch[0]?.email}).`);

        const emailPromises = subBatch.map(voter =>
            emailLimiter(async () => {
                // Optional small delay before each individual email if needed, but pLimit handles concurrency
                // await new Promise(resolve => setTimeout(resolve, 100));
                console.log(`Attempting to send email to: ${voter.email} via SendGrid`);
                try {
                    const info = await transporter.sendMail({
                        from: `"IEC Voting" <${VERIFIED_SENDER_EMAIL}>`,
                        to: voter.email,
                        subject: 'Live Debate Link - May 23, 2025',
                        text: `Hello ${voter.fullName},\n\nOur live online debate is scheduled for tomorrow, May 23, 2025, at 2:00 PM.\n\nJoin the debate using this link:\n${ZOOM_LINK}\n\nWe look forward to your participation.\n\n—IEC Team`
                    });
                    // SendGrid info might just be a success indicator or an x-message-id header
                    console.log(`Email sent successfully to: ${voter.email}, SendGrid Response: ${info.response || JSON.stringify(info)}`);
                    return { status: 'fulfilled' as const, email: voter.email };
                } catch (sendError) {
                    const err = sendError as Error & { code?: number; response?: any; responseBody?: any; errors?: {message: string}[] };
                    let detailedMessage = err.message;
                    if (err.errors && err.errors.length > 0) { // SendGrid often returns detailed errors in an array
                        detailedMessage = err.errors.map(e => e.message).join(', ');
                    } else if (err.responseBody) { // Sometimes errors are in responseBody
                        try {
                            const body = JSON.parse(err.responseBody.toString());
                            if (body.errors && body.errors.length > 0) {
                                detailedMessage = body.errors.map((e: {message: string}) => e.message).join(', ');
                            }
                        } catch (parseError) { /* ignore if not json */ }
                    }
                    console.error(`Failed to send email to: ${voter.email}, Reason: ${detailedMessage}`, err);
                    return { status: 'rejected' as const, email: voter.email, message: detailedMessage, reason: err.toString() };
                }
            })
        );

        const results = await Promise.all(emailPromises);

        results.forEach(r => {
            if (r.status === 'fulfilled') {
                totalSuccess++;
            } else {
                overallFailures.push({ email: r.email, message: r.message, reason: r.reason });
            }
        });
        votersProcessed += subBatch.length;

        console.log(`Sub-batch ${Math.floor(i / SUB_BATCH_SIZE) + 1} processed. Current success: ${totalSuccess}/${votersProcessed}.`);

        if (i + SUB_BATCH_SIZE < allVoters.length) {
            if (DELAY_BETWEEN_SUB_BATCHES_MS > 0) {
                console.log(`Pausing for ${DELAY_BETWEEN_SUB_BATCHES_MS / 1000} seconds before next sub-batch...`);
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_SUB_BATCHES_MS));
            }
        }
    }

    const finalMessage = `All ${allVoters.length} voters processed using SendGrid. Total successful emails: ${totalSuccess}. Total failures: ${overallFailures.length}.`;
    console.log(finalMessage);
    if (overallFailures.length > 0) {
        // Log simplified failures to avoid overly verbose logs for the entire error object
        console.error("Overall Failures (SendGrid):", JSON.stringify(overallFailures.map(f => ({email: f.email, message: f.message})), null, 2));
    }
    console.log(`Function invocation ended at: ${new Date().toISOString()}`);

    const statusCode = (totalSuccess > 0 && totalSuccess < allVoters.length && overallFailures.length > 0) ? 207 : // Multi-Status
                       (totalSuccess === allVoters.length && allVoters.length > 0) ? 200 : // All OK
                       (allVoters.length === 0) ? 200 : // No voters, also OK
                       502; // Primarily failures or no successes

    return NextResponse.json({
        message: finalMessage,
        totalAttempted: allVoters.length,
        totalSuccess,
        totalFailures: overallFailures.length,
        // Send simplified failures in the response
        failures: overallFailures.map(f => ({email: f.email, message: f.message}))
    }, { status: statusCode });
}
