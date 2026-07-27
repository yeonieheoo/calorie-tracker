import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      })
      if (error) throw error
      setSent(true)
    } catch (err) {
      setError(err.message || '로그인 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#FAF5EC]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-xs uppercase tracking-[0.3em] text-[#9B8D7E] mb-3">
            CALORIE TRACKER
          </div>
          <h1 className="display text-4xl font-medium mb-2">안녕, Yeonie</h1>
          <p className="text-sm text-[#6B5D4F]">
            이메일 입력하면 로그인 링크 보내줄게
          </p>
        </div>

        {sent ? (
          <div className="bg-white rounded-2xl border border-[#E8DFD0] p-6 text-center">
            <div className="text-2xl mb-2">📬</div>
            <div className="display text-lg font-medium mb-2">메일 확인해줘</div>
            <div className="text-sm text-[#6B5D4F]">
              <span className="font-medium">{email}</span>로<br />
              로그인 링크 보냈어. 클릭하면 들어와져.
            </div>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full px-4 py-3 bg-white border border-[#E8DFD0] rounded-2xl outline-none focus:border-[#B85C38] transition-colors text-sm"
            />
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 bg-[#1F1B16] text-[#FAF5EC] rounded-2xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              매직 링크 보내기
            </button>
            {error && (
              <div className="text-xs text-[#B85C38] text-center">{error}</div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
