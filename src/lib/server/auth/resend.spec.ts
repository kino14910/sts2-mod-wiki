import { describe, expect, it, vi } from 'vitest'
import { sendVerificationCode } from './resend'

describe('Resend verification delivery', () => {
	it('posts the six-digit code with a bearer key', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ id: 'email-id' }))
		await sendVerificationCode('re_test', 'no-reply@example.com', 'alice@qq.com', '123456', fetcher)
		expect(fetcher).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
			method: 'POST',
			headers: expect.objectContaining({ authorization: 'Bearer re_test' })
		}))
		const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body)) as {
			from: string; to: string[]; text: string
		}
		expect(body.from).toBe('no-reply@example.com')
		expect(body.to).toEqual(['alice@qq.com'])
		expect(body.text).toContain('123456')
	})

	it('raises a provider error when delivery fails', async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('', { status: 500 }))
		await expect(sendVerificationCode('re_test', 'no-reply@example.com', 'alice@qq.com', '123456', fetcher))
			.rejects.toMatchObject({ status: 502, code: 'EMAIL_SEND_FAILED' })
	})
})
