// src/app/api/admin/send-debate-link/route.ts
import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';
import jwt              from 'jsonwebtoken';
import { cookies }      from 'next/headers';
import nodemailer       from 'nodemailer';
import pLimit           from 'p-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET!;
const ZOOM_LINK  = process.env.ZOOM_LINK!;

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

let moduleTransporter: nodemailer.Transporter | null = null;
let moduleTransporterInitializationError: string | null = null;

if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    moduleTransporterInitializationError = "CRITICAL: SMTP environment variables are missing!";
    console.error(moduleTransporterInitializationError);
} else {
    try {
        moduleTransporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(smtpPort, 10),
            secure: (smtpPort === "465"),
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        moduleTransporter.verify().then(() => {
            console.log('SMTP Connection Verified Successfully at module load.');
        }).catch(err => {
            // Type check for 'err' from verify()
            let verifyErrorMessage = "Unknown SMTP verification error";
            if (err instanceof Error) {
                verifyErrorMessage = err.message;
            } else if (typeof err === 'string') {
                verifyErrorMessage = err;
            }
            console.error(`SMTP verification at module load failed (will try sending anyway): ${verifyErrorMessage}`, err);
        });
    } catch (error) { // 'error' here is 'unknown'
        // ---- FIX IS HERE ----
        if (error instanceof Error) {
            moduleTransporterInitializationError = `Error creating SMTP transporter: ${error.message}`;
        } else if (typeof error === 'string') {
            moduleTransporterInitializationError = `Error creating SMTP transporter: ${error}`;
        } else {
            moduleTransporterInitializationError = `Error creating SMTP transporter: An unknown error occurred.`;
        }
        // ---- END FIX ----
        console.error(moduleTransporterInitializationError, error); // Log the original error too
        moduleTransporter = null;
    }
}

// ... (The rest of your POST function remains the same) ...
export async function POST() {
    console.log(`Function invocation started at: ${new Date().toISOString()}`);

    if (moduleTransporterInitializationError) {
        console.error("Responding with 500 due to transporter initialization error:", moduleTransporterInitializationError);
        return NextResponse.json({ error: `SMTP Transporter not initialized: ${moduleTransporterInitializationError}` }, { status: 500 });
    }
    if (!moduleTransporter) {
        console.error("Responding with 500 because transporter is not available (unexpected state).");
        return NextResponse.json({ error: "SMTP Transporter is not available (unexpected state)." }, { status: 500 });
    }
    const transporter = moduleTransporter;


    const token = cookies().get('admin_token');
    if (!token) {
        console.log("Unauthorized: No admin token found.");
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        jwt.verify(token.value, JWT_SECRET);
    } catch (jwtError) { // Give a different name to avoid confusion
        let message = "Invalid token";
        if (jwtError instanceof Error) {
            message = `Invalid token: ${jwtError.message}`;
        }
        console.log(message, jwtError);
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
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

    const SUB_BATCH_SIZE = 10;
    const DELAY_BETWEEN_SUB_BATCHES_MS = 3000;
    const CONCURRENT_SEND_LIMIT = 2;

    const emailLimiter = pLimit(CONCURRENT_SEND_LIMIT);
    let totalSuccess = 0;
    const overallFailures: { email: string; message: string; reason?: string }[] = [];
    let votersProcessed = 0;

    for (let i = 0; i < allVoters.length; i += SUB_BATCH_SIZE) {
        const subBatch = allVoters.slice(i, i + SUB_BATCH_SIZE);
        console.log(`Processing sub-batch ${Math.floor(i / SUB_BATCH_SIZE) + 1}: ${subBatch.length} voters (starting with ${subBatch[0]?.email}).`);

        const emailPromises = subBatch.map(voter =>
            emailLimiter(async () => {
                console.log(`Attempting to send email to: ${voter.email}`);
                try {
                    if (!smtpUser) throw new Error("SMTP user is not defined for 'from' field.");
                    const info = await transporter.sendMail({
                        from: `"IEC Voting" <${smtpUser}>`,
                        to: voter.email,
                        subject: 'Live Debate Link - May 23, 2025',
                        text: `Hello ${voter.fullName},\n\nOur live online debate is scheduled for tomorrow, May 23, 2025, at 2:00 PM.\n\nJoin the debate using this link:\n${ZOOM_LINK}\n\nWe look forward to your participation.\n\n—IEC Team`
                    });
                    console.log(`Email sent successfully to: ${voter.email}, Message ID: ${info.messageId}`);
                    return { status: 'fulfilled' as const, email: voter.email };
                } catch (sendError) { // Changed variable name from 'error'
                    const err = sendError as Error;
                    console.error(`Failed to send email to: ${voter.email}, Reason:`, err.message, err);
                    return { status: 'rejected' as const, email: voter.email, message: err.message, reason: err };
                }
            })
        );

        const results = await Promise.all(emailPromises);

        results.forEach(r => {
            if (r.status === 'fulfilled') {
                totalSuccess++;
            } else {
                overallFailures.push({ email: r.email, message: r.message, reason: r.reason?.toString() });
            }
        });
        votersProcessed += subBatch.length;

        console.log(`Sub-batch ${Math.floor(i / SUB_BATCH_SIZE) + 1} processed. Current success: ${totalSuccess}/${votersProcessed}.`);

        if (i + SUB_BATCH_SIZE < allVoters.length) {
            console.log(`Pausing for ${DELAY_BETWEEN_SUB_BATCHES_MS / 1000} seconds before next sub-batch...`);
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_SUB_BATCHES_MS));
        }
    }

    const finalMessage = `All ${allVoters.length} voters processed. Total successful emails: ${totalSuccess}. Total failures: ${overallFailures.length}.`;
    console.log(finalMessage);
    if (overallFailures.length > 0) {
        console.error("Overall Failures:", JSON.stringify(overallFailures.map(f => ({email: f.email, message: f.message})), null, 2));
    }
    console.log(`Function invocation ended at: ${new Date().toISOString()}`);

    const statusCode = (totalSuccess > 0 && totalSuccess < allVoters.length && overallFailures.length > 0) ? 207 :
                       (totalSuccess === allVoters.length && allVoters.length > 0) ? 200 :
                       (allVoters.length === 0) ? 200 :
                       502;

    return NextResponse.json({
        message: finalMessage,
        totalAttempted: allVoters.length,
        totalSuccess,
        totalFailures: overallFailures.length,
        failures: overallFailures.map(f => ({email: f.email, message: f.message}))
    }, { status: statusCode });
}
