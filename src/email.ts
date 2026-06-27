import nodemailer from "nodemailer";

export interface EmailConfig {
	host: string;
	port: number;
	user: string;
	pass: string;
	to: string;
}

export function getEmailConfig(): EmailConfig {
	return {
		host: process.env.SMTP_HOST || "smtp.gmail.com",
		port: Number(process.env.SMTP_PORT) || 587,
		user: process.env.EMAIL_USER || "",
		pass: process.env.EMAIL_PASS || "",
		to: process.env.EMAIL_TO || process.env.EMAIL_USER || "",
	};
}

export function isEmailConfigured(): boolean {
	const config = getEmailConfig();
	return Boolean(config.user && config.pass && config.to);
}

export async function sendReportEmail(
	subject: string,
	body: string,
): Promise<void> {
	const config = getEmailConfig();

	if (!config.user || !config.pass) {
		throw new Error(
			"Email not configured. Set EMAIL_USER and EMAIL_PASS in your .env file.",
		);
	}

	const transporter = nodemailer.createTransport({
		host: config.host,
		port: config.port,
		secure: config.port === 465,
		auth: {
			user: config.user,
			pass: config.pass,
		},
	});

	await transporter.sendMail({
		from: `"USD News Agent" <${config.user}>`,
		to: config.to,
		subject,
		text: body,
	});

	console.log(`📧 Email sent to ${config.to}`);
}
