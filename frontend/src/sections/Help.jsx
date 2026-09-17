import { Card } from '../components/ui'

const rows = [
  ['1. 扫码登录闲鱼', '打开“设置”，点“扫码登录”，用手机闲鱼 App 扫码并确认。顶部出现“登录态正常”就成功了。'],
  ['2. 创建监控任务', '打开“监控任务”，填写想找的商品和价格。地区、成色都是选填；条件越多，越可能找不到。'],
  ['3. 立即检查一次', '点右上角“立即检查”。第一次会记录已有商品，结果可能较多；以后只提醒新出现的商品。'],
  ['4. 手机提醒（选做）', '不设置也能正常监控，只是需要在电脑上看结果。iPhone 可用 Bark，安卓可用 PushPlus，二选一即可。'],
  ['5. 保持软件开启', '这是电脑本地版：电脑开机、网络正常、软件没有退出时才会自动检查。'],
]

export default function Help() {
  return (
    <section>
      <div className="page-hero compact"><div><span className="eyebrow">新手指南</span><h1 className="page-title">5 分钟开始监控</h1>
      <p className="page-sub">只有“登录、创建任务、检查一次”是必做。手机提醒、AI 和邮件都是选做。</p></div></div>
      <div className="help-list">
        {rows.map(([title, text]) => (
          <Card className="help-step" key={title}>
            <div className="form-title">{title}</div>
            <p>{text}</p>
          </Card>
        ))}
      </div>
      <Card className="form-card">
        <div className="form-title">常见问题</div>
        <dl className="faq">
          <dt>为什么第二次运行新增是0？</dt><dd>说明去重正常；只有新发布且符合条件的商品才会再次提醒。</dd>
          <dt>关闭软件还能监控吗？</dt><dd>不能。当前是 Windows 本地版，电脑和软件都要保持运行。</dd>
          <dt>为什么推送失败？</dt><dd>先检查地址或 Token，再检查代理/TUN。Clash Fake-IP 异常时可关闭 TUN 并刷新 DNS。</dd>
          <dt>需要开启 AI 审核吗？</dt><dd>第一版不需要。没有配置模型 API Token 时建议保持关闭。</dd>
          <dt>会自动下单付款吗？</dt><dd>不会。本软件负责监控、筛选和提醒，点击通知后由用户自行判断并购买。</dd>
        </dl>
      </Card>
    </section>
  )
}
