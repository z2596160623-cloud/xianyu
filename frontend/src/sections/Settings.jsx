import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { Card, Button, Spinner, Toggle, Field, ConfirmDialog } from '../components/ui'

export default function Settings({ status }) {
  const [cfg, setCfg] = useState(null)
  const [saved, setSaved] = useState(false)
  const [pwd, setPwd] = useState('') // SMTP 密码单独管理: 只在用户输入时才提交
  const [token, setToken] = useState('') // LLM token 同理(只写)
  const [barkUrl, setBarkUrl] = useState('')
  const [pushplusToken, setPushplusToken] = useState('')
  const [dingtalkUrl, setDingtalkUrl] = useState('')
  const [testMsg, setTestMsg] = useState(null)
  const [testing, setTesting] = useState(false)
  const [llmMsg, setLlmMsg] = useState(null) // LLM 测试结果
  const [llmTesting, setLlmTesting] = useState(false)
  const [login, setLogin] = useState({ status: 'idle', has_state: false })
  const [confirmLogout, setConfirmLogout] = useState(false)
  const loginTimer = useRef(null)

  useEffect(() => {
    api.config().then(setCfg)
    api.loginStatus().then(setLogin)
    return () => clearInterval(loginTimer.current)
  }, [])

  const startLogin = async () => {
    setLogin((l) => ({ ...l, status: 'starting', qr: null }))
    await api.loginStart()
    clearInterval(loginTimer.current)
    loginTimer.current = setInterval(async () => {
      const st = await api.loginStatus()
      setLogin(st)
      if (['success', 'expired', 'failed', 'idle', 'busy'].includes(st.status)) {
        clearInterval(loginTimer.current)
      }
    }, 2000)
  }

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }))

  // 密码/token 留空 → 发 null(不修改); 输入了 → 发新值
  const payload = () => ({
    ...cfg,
    smtp_pass: pwd.trim() || null,
    review_api_token: token.trim() || null,
    bark_url: barkUrl.trim() || null,
    pushplus_token: pushplusToken.trim() || null,
    dingtalk_webhook: dingtalkUrl.trim() || null,
  })

  const save = async () => {
    const next = await api.saveConfig(payload())
    setCfg(next)
    setPwd('')
    setToken('')
    setBarkUrl('')
    setPushplusToken('')
    setDingtalkUrl('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const testPush = async () => {
    setTesting(true)
    setTestMsg(null)
    try {
      await api.saveConfig(payload())
      setBarkUrl('')
      setPushplusToken('')
      setDingtalkUrl('')
      const r = await api.testPush()
      setTestMsg(r.ok ? { ok: true, text: `手机推送成功（${r.sent}个渠道）` } : { ok: false, text: r.error })
      api.config().then(setCfg)
    } finally {
      setTesting(false)
    }
  }

  const test = async () => {
    setTesting(true)
    setTestMsg(null)
    try {
      await api.saveConfig(payload()) // 先存最新配置再测
      setPwd('')
      const r = await api.testEmail()
      setTestMsg(r.ok ? { ok: true, text: `已发送到 ${r.to}` } : { ok: false, text: r.error })
      if (r.ok) api.config().then(setCfg)
    } finally {
      setTesting(false)
    }
  }

  // 测试 LLM: 先存最新配置(含刚填的 token), 再用它对一条样例做一次真实调用
  const testLLM = async () => {
    setLlmTesting(true)
    setLlmMsg(null)
    try {
      await api.saveConfig(payload())
      setToken('')
      const r = await api.testReview()
      setLlmMsg(
        r.ok
          ? { ok: true, text: `AI 审核可用 · 模型 ${r.model}` }
          : { ok: false, text: r.error },
      )
      api.config().then(setCfg)
    } finally {
      setLlmTesting(false)
    }
  }

  const logout = async () => {
    setConfirmLogout(false)
    clearInterval(loginTimer.current)
    setLogin(await api.logout())
  }

  // 「登录中」: 已扫码等手机确认 / 刚启动还没出二维码
  const loggingIn =
    ['starting', 'scanned'].includes(login.status) ||
    (login.status === 'waiting' && !login.qr)

  if (!cfg) return <Spinner />

  return (
    <section>
      <div className="page-hero compact"><div><span className="eyebrow">账号与运行</span><h1 className="page-title">设置</h1>
      <p className="page-sub">普通用户只需登录闲鱼和选择检查间隔。手机提醒、AI 和邮件均为选做。</p></div></div>

      <Card className="form-card quick-guide">
        <div className="form-title">首次使用，只有3步必做</div>
        <div className="guide-steps">
          <span><b>1</b>扫码登录闲鱼</span>
          <span><b>2</b>到「监控任务」填商品和价格</span>
          <span><b>3</b>点右上角「立即检查」</span>
        </div>
        <p className="form-hint">手机提醒可以稍后再设置，跳过不影响电脑端监控。</p>
      </Card>

      <Card className="form-card">
        <div className="form-title">闲鱼登录</div>
        <p className="form-hint">
          首次使用或登录过期时点这里扫码（手机「闲鱼」App → 我的 → 右上角「扫一扫」）。登录态保存在本地，容器重启不丢。
        </p>
        {loggingIn ? (
          <div className="qr-wrap">
            <div className="spinner" />
            <div className="qr-tip">{login.message || '登录中…'}</div>
          </div>
        ) : login.qr ? (
          <div className="qr-wrap">
            <img className="qr-img" src={login.qr} alt="登录二维码" />
            <div className="qr-tip">{login.message || '用闲鱼 App 扫一扫，扫完在手机点确认'}</div>
          </div>
        ) : login.status === 'success' ? (
          <div className="login-row">
            <span className="test-ok">✓ {login.message || '登录成功'}</span>
            <div className="grow" />
            <Button variant="ghost" onClick={() => setConfirmLogout(true)}>
              退出登录
            </Button>
          </div>
        ) : (
          <div className="login-row">
            <span className={login.has_state ? 'login-state on' : 'login-state'}>
              {login.has_state
                ? `● 已登录${login.account ? '：' + login.account : ''}`
                : '○ 未登录'}
            </span>
            {['expired', 'failed', 'busy'].includes(login.status) && (
              <span className="test-err">{login.message}</span>
            )}
            <div className="grow" />
            {login.has_state && (
              <Button variant="ghost" onClick={() => setConfirmLogout(true)}>
                退出 / 换号
              </Button>
            )}
            <Button onClick={startLogin} disabled={['waiting'].includes(login.status)}>
              {login.has_state ? '重新扫码登录' : '扫码登录'}
            </Button>
          </div>
        )}
      </Card>

      <Card className="form-card">
        <div className="form-title">手机提醒 <span className="optional-tag">选做</span></div>
        <p className="form-hint">不配置也能正常监控，只是需要打开电脑查看。需要时三种方式任选一种，不要全部配置。</p>
        <div className="push-platforms">
          <div className="push-platform recommended">
            <div className="push-platform-title"><i className="ti ti-brand-apple" />iPhone · Bark <em>推荐</em></div>
            <p>安装 Bark，复制以 https://api.day.app/ 开头的个人地址。</p>
            <Field label="Bark 推送地址" hint={cfg.bark_url_set ? '已设置，留空则不修改' : '不要包含末尾的 /Body Text'}>
              <input type="password" value={barkUrl} onChange={(e) => setBarkUrl(e.target.value)}
                placeholder={cfg.bark_url_set ? '••••••（已设置）' : 'https://api.day.app/你的Key'} />
            </Field>
          </div>
          <div className="push-platform recommended">
            <div className="push-platform-title"><i className="ti ti-brand-android" />安卓 · PushPlus <em>微信接收</em></div>
            <p>在 PushPlus 官网绑定微信后复制 Token。平台要求实名，免费额度每天200次。</p>
            <Field label="PushPlus Token" hint={cfg.pushplus_token_set ? '已设置，留空则不修改' : '只填写 Token，不要填写网页地址'}>
              <input type="password" value={pushplusToken} onChange={(e) => setPushplusToken(e.target.value)}
                placeholder={cfg.pushplus_token_set ? '••••••（已设置）' : '你的 PushPlus Token'} />
            </Field>
            <a className="setup-link" href="https://www.pushplus.plus/" target="_blank" rel="noreferrer">打开 PushPlus 官网</a>
          </div>
          <div className="push-platform">
            <div className="push-platform-title"><i className="ti ti-brand-dingtalk" />安卓 / iPhone · 钉钉</div>
            <p>适合已经使用钉钉群机器人的用户，新手可以先跳过。</p>
            <Field label="钉钉机器人 Webhook" hint={cfg.dingtalk_webhook_set ? '已设置，留空则不修改' : '群机器人提供的 https 地址'}>
              <input type="password" value={dingtalkUrl} onChange={(e) => setDingtalkUrl(e.target.value)}
                placeholder={cfg.dingtalk_webhook_set ? '••••••（已设置）' : 'https://oapi.dingtalk.com/robot/send?...'} />
            </Field>
          </div>
        </div>
        <div className="form-row">
          {testMsg && <span className={testMsg.ok ? 'test-ok' : 'test-err'}>{testMsg.ok ? '✓ ' : '✗ '}{testMsg.text}</span>}
          <div className="grow" />
          <Button variant="ghost" onClick={testPush} disabled={testing}>{testing ? '发送中…' : '测试手机推送'}</Button>
          <Button onClick={save}>保存</Button>
        </div>
      </Card>

      <Card className="form-card">
        <div className="form-title">自动检查</div>
        <div className="form-grid">
          <Field label="每隔多久检查一次" hint="10分钟适合大多数人，越快越容易触发闲鱼限制">
            <select
              value={cfg.schedule_minutes}
              onChange={(e) => set('schedule_minutes', Number(e.target.value))}
            ><option value={5}>5分钟（较快）</option><option value={10}>10分钟（推荐）</option><option value={30}>30分钟（更稳妥）</option></select>
          </Field>
        </div>
        <div className="form-row basic-actions">
          <Toggle checked={cfg.paused} onChange={(v) => set('paused', v)} label="暂停自动检查" />
          <div className="grow" />
          {saved && <span className="saved-hint">已保存</span>}
          <Button onClick={save}>保存基础设置</Button>
        </div>
        <details className="advanced-block req-field">
          <summary><span><i className="ti ti-adjustments-horizontal" /> 更多运行参数</span><em>保持默认即可</em></summary>
          <div className="advanced-body"><div className="form-grid">
          <Field label="收藏刷新间隔（分钟）" hint="独立定时: 刷新收藏价格/降价/死链">
            <input
              type="number"
              value={cfg.favorites_minutes}
              onChange={(e) => set('favorites_minutes', Number(e.target.value))}
            />
          </Field>
          <Field label="降价阈值（百分比 %）">
            <input
              type="number"
              value={cfg.min_drop_pct}
              onChange={(e) => set('min_drop_pct', Number(e.target.value))}
            />
          </Field>
          <Field label="降价阈值（金额 ¥）">
            <input
              type="number"
              value={cfg.min_drop_abs}
              onChange={(e) => set('min_drop_abs', Number(e.target.value))}
            />
          </Field>
          <Field label="收件邮箱">
            <input value={cfg.notify_to} onChange={(e) => set('notify_to', e.target.value)} />
          </Field>
          <Field label="搜索翻页上限">
            <input
              type="number"
              value={cfg.search_max_pages}
              onChange={(e) => set('search_max_pages', Number(e.target.value))}
            />
          </Field>
          <Field label="收藏翻页上限">
            <input
              type="number"
              value={cfg.favorites_max_pages}
              onChange={(e) => set('favorites_max_pages', Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="form-row">
          <Toggle checked={cfg.headless} onChange={(v) => set('headless', v)} label="无头浏览器" />
          <div className="grow" />
          {saved && <span className="saved-hint">已保存</span>}
          <Button onClick={save}>保存</Button>
        </div>
          </div>
        </details>
      </Card>

      <details className="advanced-settings">
        <summary><span><i className="ti ti-adjustments" /> 高级功能</span><em>普通用户无需打开</em></summary>
      <Card className="form-card">
        <div className="form-title">邮件通知（SMTP）</div>
        <p className="form-hint">
          收到降价 / 收藏变动时发邮件到上方「收件邮箱」。留空则回退系统环境变量。
        </p>
        <div className="form-grid">
          <Field label="SMTP 服务器" hint="如 smtp.exmail.qq.com">
            <input
              value={cfg.smtp_host || ''}
              onChange={(e) => set('smtp_host', e.target.value)}
              placeholder="smtp.exmail.qq.com"
            />
          </Field>
          <Field label="端口" hint="SSL 通常 465">
            <input
              type="number"
              value={cfg.smtp_port ?? 465}
              onChange={(e) => set('smtp_port', Number(e.target.value))}
            />
          </Field>
          <Field label="发件账号">
            <input
              value={cfg.smtp_user || ''}
              onChange={(e) => set('smtp_user', e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="密码 / 授权码" hint={cfg.smtp_pass_set ? '已设置，留空则不修改' : '邮箱 SMTP 授权码'}>
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder={cfg.smtp_pass_set ? '••••••（已设置）' : ''}
            />
          </Field>
        </div>
        <div className="req-field">
          <span className="field-label">邮件提醒哪些事件</span>
          <div className="form-row">
            <Toggle checked={cfg.notify_on_new} onChange={(v) => set('notify_on_new', v)} label="发现新推荐" />
            <Toggle checked={cfg.notify_on_drop} onChange={(v) => set('notify_on_drop', v)} label="收藏降价" />
            <Toggle checked={cfg.notify_on_sold} onChange={(v) => set('notify_on_sold', v)} label="已售出·下架" />
            <Toggle checked={cfg.notify_on_login} onChange={(v) => set('notify_on_login', v)} label="登录失效" />
          </div>
        </div>
        <div className="form-row">
          {testMsg && (
            <span className={testMsg.ok ? 'test-ok' : 'test-err'}>
              {testMsg.ok ? '✓ ' : '✗ '}
              {testMsg.text}
            </span>
          )}
          <div className="grow" />
          <Button variant="ghost" onClick={test} disabled={testing}>
            {testing ? '发送中…' : '发送测试邮件'}
          </Button>
          <Button onClick={save}>保存</Button>
        </div>
      </Card>

      <Card className="form-card">
        <div className="form-title">AI 审核（LLM）</div>
        <p className="form-hint">
          搜索命中后交给大模型按每条监控条件的「AI 审核要求」二次筛选。任意 OpenAI 兼容接口。接口地址 /
          密钥也可放本地 data/secret.env（XIANYU_REVIEW_BASE_URL / XIANYU_REVIEW_API_TOKEN），不入仓库。关闭则所有命中都直接进推荐。
        </p>
        <div className="form-grid">
          <Field label="接口地址" hint="OpenAI 兼容 base url；留空用本地 secret.env">
            <input
              value={cfg.review_base_url || ''}
              onChange={(e) => set('review_base_url', e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </Field>
          <Field label="模型">
            <input
              value={cfg.review_model || ''}
              onChange={(e) => set('review_model', e.target.value)}
              placeholder="doubao-seed-2.0-pro"
            />
          </Field>
          <Field
            label="API Token"
            hint={cfg.review_token_set ? '已设置，留空则不修改' : '无鉴权可留空'}
          >
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={cfg.review_token_set ? '••••••（已设置）' : ''}
            />
          </Field>
          <Field label="超时（秒）">
            <input
              type="number"
              value={cfg.review_timeout}
              onChange={(e) => set('review_timeout', Number(e.target.value))}
            />
          </Field>
          <Field label="温度 temperature" hint="0 最确定">
            <input
              type="number"
              step="0.1"
              value={cfg.review_temperature}
              onChange={(e) => set('review_temperature', Number(e.target.value))}
            />
          </Field>
          <Field label="最大 tokens">
            <input
              type="number"
              value={cfg.review_max_tokens}
              onChange={(e) => set('review_max_tokens', Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="req-field">
          <Field label="系统提示词" hint="大模型的判定规则；留空恢复默认">
            <textarea
              className="req-input"
              rows={4}
              value={cfg.review_system_prompt || ''}
              onChange={(e) => set('review_system_prompt', e.target.value)}
            />
          </Field>
        </div>
        <div className="form-row">
          <Toggle
            checked={cfg.review_enabled}
            onChange={(v) => set('review_enabled', v)}
            label="启用 AI 审核"
          />
          {llmMsg && (
            <span className={llmMsg.ok ? 'test-ok' : 'test-err'}>
              {llmMsg.ok ? '✓ ' : '✗ '}
              {llmMsg.text}
            </span>
          )}
          <div className="grow" />
          {saved && <span className="saved-hint">已保存</span>}
          <Button variant="ghost" onClick={testLLM} disabled={llmTesting}>
            {llmTesting ? '测试中…' : '测试 LLM'}
          </Button>
          <Button onClick={save}>保存</Button>
        </div>
      </Card>

      <Card className="form-card">
        <div className="form-title">高级（抓取 / 反爬）</div>
        <p className="form-hint">一般无需改动。闲鱼接口地址、操作随机延迟、死链核活上限。</p>
        <div className="form-grid">
          <Field label="操作延迟下限（秒）" hint="点击/收藏前随机等待">
            <input
              type="number"
              step="0.5"
              value={cfg.action_delay_min}
              onChange={(e) => set('action_delay_min', Number(e.target.value))}
            />
          </Field>
          <Field label="操作延迟上限（秒）">
            <input
              type="number"
              step="0.5"
              value={cfg.action_delay_max}
              onChange={(e) => set('action_delay_max', Number(e.target.value))}
            />
          </Field>
          <Field label="死链核活上限（条/轮）" hint="每轮最多打开多少详情页核活">
            <input
              type="number"
              value={cfg.liveness_max_checks}
              onChange={(e) => set('liveness_max_checks', Number(e.target.value))}
            />
          </Field>
          <Field label="搜索页 URL">
            <input value={cfg.search_url || ''} onChange={(e) => set('search_url', e.target.value)} />
          </Field>
          <Field label="收藏页 URL">
            <input
              value={cfg.favorites_url || ''}
              onChange={(e) => set('favorites_url', e.target.value)}
            />
          </Field>
        </div>
        <div className="form-row">
          <div className="grow" />
          {saved && <span className="saved-hint">已保存</span>}
          <Button onClick={save}>保存</Button>
        </div>
      </Card>
      </details>

      <Card className="form-card">
        <div className="form-title">运行状态</div>
        <div className="status-grid">
          <div>
            <span className="status-k">当前</span>
            <span className="status-v">{status?.running ? '运行中' : '空闲'}</span>
          </div>
          <div>
            <span className="status-k">间隔</span>
            <span className="status-v">{status?.schedule_minutes ?? cfg.schedule_minutes} 分钟</span>
          </div>
          <div>
            <span className="status-k">定时</span>
            <span className="status-v">{cfg.paused ? '已暂停' : '运行中'}</span>
          </div>
        </div>
        {status?.last && (
          <div className="last-run">
            上轮：{status.last.error
              ? `出错 — ${status.last.error}`
              : `新推荐 ${status.last.recommendations ?? 0} · 降价 ${status.last.drops ?? 0} · 已通知 ${status.last.notified ?? 0}`}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmLogout}
        danger
        title="退出登录 / 换号"
        message="确定退出并清除本地登录态？下次需要重新扫码登录。"
        confirmText="退出"
        onConfirm={logout}
        onCancel={() => setConfirmLogout(false)}
      />
    </section>
  )
}
