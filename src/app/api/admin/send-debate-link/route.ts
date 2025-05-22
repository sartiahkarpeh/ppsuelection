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

// ---- START: Debugging and SMTP Configuration ----
console.log("--- Initializing SMTP Transporter ---");
console.log("Attempting to use SMTP Host from env:", process.env.SMTP_HOST);
console.log("Attempting to use SMTP Port from env:", process.env.SMTP_PORT);
// Avoid logging sensitive credentials directly in production, but for initial local debugging:
// console.log("Attempting to use SMTP User from env:", process.env.SMTP_USER);
// console.log("Attempting to use SMTP Pass from env:", process.env.SMTP_PASS ? "Loaded" : "NOT LOADED");

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    console.error("CRITICAL: SMTP environment variables are missing at module load time!");
    // You might want to throw an error here or handle this case more gracefully
    // For now, Nodemailer will likely fail or use defaults below.
}

const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort || "587", 10), // Ensure port is a number, provide a fallback if necessary
    secure: (smtpPort === "465"), // true for port 465, false for other ports (like 587 which uses STARTTLS)
    auth: {
        user: smtpUser,
        pass: smtpPass,
    },
    // Optional: Add TLS options if needed, especially for some environments or strict TLS policies
    // tls: {
    //   // do not fail on invalid certs if you are in a corporate environment with self-signed certs
    //   // rejectUnauthorized: false 
    //   ciphers:'SSLv3' // Sometimes needed for older services or specific configurations
    // }
});

console.log("Transporter created. Verifying SMTP connection...");
// ---- END: Debugging and SMTP Configuration ----

// verify once at startup
transporter.verify().then(() => {
    console.log('SMTP Connection Verified Successfully.');
}).catch(err => {
    console.error('SMTP setup failed during verify():', err); // This will show the detailed error
});

export async function POST() {
    // ... (rest of your POST function)
    // Make sure you're also using process.env.SMTP_USER within sendMail if that's intended,
    // which you are: from: `"IEC Voting" <${process.env.SMTP_USER}>`,
    // If smtpUser (defined above) is correctly loaded, you can use that too:
    // from: `"IEC Voting" <${smtpUser}>`,

    const token = cookies().get('admin_token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try { jwt.verify(token.value, JWT_SECRET); }
    catch { return NextResponse.json({ error: 'Invalid token' }, { status: 401 }); }

    const voters = await prisma.voter.findMany({ select: { email: true, fullName: true } });

    if (voters.length === 0) {
        return NextResponse.json({ message: "No voters found to send emails to.", failures: [] }, { status: 200 });
    }

    const limit = pLimit(10); // at most 10 concurrent SMTP connections
    const results = await Promise.allSettled(
        voters.map(v =>
            limit(() =>
                transporter.sendMail({
                    from: `"IEC Voting" <${smtpUser}>`, // Using smtpUser defined above
                    to:   v.email,
                    subject: 'Live Debate Link - May 23, 2025', // Updated subject for clarity
                    text: `Hello ${v.fullName},\n\nOur live online debate is scheduled for tomorrow, May 23, 2025, at 2:00 PM.\n\nJoin the debate using this link:\n${ZOOM_LINK}\n\nWe look forward to your participation.\n\n—IEC Team`
                })
            )
        )
    );

    let success = 0;
    const failures: { email: string; message: string }[] = [];
    results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
            success++;
            console.log(`Email sent successfully to: ${voters[i].email}`);
        } else {
            failures.push({ email: voters[i].email, message: r.reason.message });
            console.error(`Failed to send email to: ${voters[i].email}, Reason:`, r.reason);
        }
    });

    const msg = `Debate link processing complete. Sent to ${success} of ${voters.length} voters.`;
    console.log(msg);
    if (failures.length > 0) {
        console.error("Failures:", failures);
    }
    // const code = success === 0 && voters.length > 0 ? 502 : 200; // Consider 502 if all fail for actual voters
    const code = failures.length === voters.length && voters.length > 0 ? 502 : 200;
    return NextResponse.json({ message: msg, failures }, { status: code });
}
