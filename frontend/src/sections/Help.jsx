import { Card } from '../components/ui'

const rows = [
  ['1. 登录闲鱼', '设置 → 扫码登录，用手机闲鱼确认。顶部显示“登录态正常”才算成功。'],
  ['2. 添加条件', '条件 → 新增。先只填搜索词和价格，地区、成色等筛选确认能抓到后再加。'],
  ['3. 配置推送', 'iPhone 推荐 Bark；安卓推荐 PushPlus 微信；已有钉钉群的用户也可使用机器人。三选一即可。'],
  ['4. 手动试跑', '右上角“立即运行”选择条件。首次结果较多属于正常，后续会自动去重。'],
  ['5. 自动监控', '设置推荐抓取间隔并保存。电脑与软件必须保持开启，关机后停止监控。'],
]

export default function Help() {
  return (
    <section>
      <h1 className="page-title">使用帮助</h1>
      <p className="page-sub">第一次使用按顺序完成下面5步，不需要配置 AI、邮箱或高级选项。</p>
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
