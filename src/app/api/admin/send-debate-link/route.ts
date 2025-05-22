// src/app/api/admin/send-debate-link/route.ts
import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';
import jwt              from 'jsonwebtoken';
import { cookies }      from 'next/headers';
import pLimit           from 'p-limit';
import sgMail           from '@sendgrid/mail'; // Import @sendgrid/mail

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Environment Variables
const JWT_SECRET = process.env.JWT_SECRET!;
const ZOOM_LINK  = process.env.ZOOM_LINK!;
const sendgridApiKey = process.env.SENDGRID_API_KEY;

// This should be your SendGrid verified single sender email address
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
    console.log(`Function invocation started at: ${new Date().toISOString()}`);

    if (sendgridInitializationError || !sendgridInitialized) {
        const errorMsg = sendgridInitializationError || "SendGrid mail client not initialized (unexpected state).";
        console.error("Responding with 500 due to SendGrid client initialization error:", errorMsg);
        return NextResponse.json({ error: `Mail client not initialized: ${errorMsg}` }, { status: 500 });
    }

    const token = cookies().get('admin_token');
    if (!token) { /* ... (auth logic remains the same) ... */ return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
    try { jwt.verify(token.value, JWT_SECRET); }
    catch (jwtError) { /* ... (auth logic remains the same) ... */ return NextResponse.json({ error: 'Invalid token' }, { status: 401 }); }

    if (!ZOOM_LINK) { /* ... (config check remains the same) ... */ return NextResponse.json({ error: 'Server configuration error: Missing Zoom link.' }, { status: 500 }); }

    console.log("Fetching all voters...");
    const allVoters = await prisma.voter.findMany({ select: { email: true, fullName: true } });

    if (allVoters.length === 0) { /* ... (no voters logic remains the same) ... */ return NextResponse.json({ message: "No voters found...", status: 200 }); }
    console.log(`Found ${allVoters.length} voters in total.`);

    const SUB_BATCH_SIZE = 20;
    const DELAY_BETWEEN_SUB_BATCHES_MS = 500;
    const CONCURRENT_SEND_LIMIT = 8;

    const emailLimiter = pLimit(CONCURRENT_SEND_LIMIT);
    let totalSuccess = 0;
    const overallFailures: { email: string; message: string; reason?: string }[] = [];
    let votersProcessed = 0;

    for (let i = 0; i < allVoters.length; i += SUB_BATCH_SIZE) {
        const subBatch = allVoters.slice(i, i + SUB_BATCH_SIZE);
        console.log(`Processing sub-batch ${Math.floor(i / SUB_BATCH_SIZE) + 1}: ${subBatch.length} voters (starting with ${subBatch[0]?.email}).`);

        const emailPromises = subBatch.map(voter =>
            emailLimiter(async () => {
                console.log(`Attempting to send email to: ${voter.email} via @sendgrid/mail`);
                const msg = {
                    to: voter.email,
                    from: { // For @sendgrid/mail, 'from' can be an object
                        email: VERIFIED_SENDER_EMAIL,
                        name: "IEC Voting"
                    },
                    subject: 'Live Debate Link - May 23, 2025',
                    text: `Hello ${voter.fullName},\n\nOur live online debate is scheduled for tomorrow, May 23, 2025, at 2:00 PM.\n\nJoin the debate using this link:\n${ZOOM_LINK}\n\nWe look forward to your participation.\n\n—IEC Team`,
                    // html: `<strong>Hello ${voter.fullName}</strong>,...` // You can add HTML version too
                };
                try {
                    await sgMail.send(msg);
                    console.log(`Email sent successfully to: ${voter.email}`);
                    return { status: 'fulfilled' as const, email: voter.email };
                } catch (sendError) {
                    const err = sendError as Error & { response?: { body?: { errors?: {message: string}[] } } };
                    let detailedMessage = err.message;
                    // Try to get more specific error from SendGrid's response
                    if (err.response && err.response.body && err.response.body.errors && err.response.body.errors.length > 0) {
                        detailedMessage = err.response.body.errors.map(e => e.message).join(', ');
                    }
                    console.error(`Failed to send email to: ${voter.email}, Reason: ${detailedMessage}`, err.response?.body || err);
                    return { status: 'rejected' as const, email: voter.email, message: detailedMessage, reason: err.toString() };
                }
            })
        );

        const results = await Promise.all(emailPromises);
        // ... (your result processing logic for totalSuccess and overallFailures remains the same) ...
        results.forEach(r => { /* ... */ });
        votersProcessed += subBatch.length;
        console.log(`Sub-batch ${Math.floor(i / SUB_BATCH_SIZE) + 1} processed. Current success: ${totalSuccess}/${votersProcessed}.`);
        if (i + SUB_BATCH_SIZE < allVoters.length) { /* ... pause ... */ await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_SUB_BATCHES_MS)); }

    }
    // ... (your final message and response logic remains the same) ...
    const finalMessage = `All ${allVoters.length} voters processed using @sendgrid/mail...`;
    console.log(finalMessage);
    return NextResponse.json({ /* ... */ });
}
