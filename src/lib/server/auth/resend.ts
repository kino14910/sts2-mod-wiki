import { WikiCollaborationError } from '#lib/server/wiki/access'

type Fetch = typeof fetch

export async function sendVerificationCode(
	apiKey: string, from: string, to: string, code: string, fetcher: Fetch = fetch
): Promise<void> {
	const response = await fetcher('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			authorization: `Bearer ${apiKey}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify({
			from,
			to: [to],
			subject: 'Your QQ email verification code',
			text: `Your verification code is ${code}. It expires in 5 minutes. If you did not request this, ignore this email.`
		})
	})
	if (!response.ok)
		throw new WikiCollaborationError(502, 'Verification email could not be sent', 'EMAIL_SEND_FAILED')
}
