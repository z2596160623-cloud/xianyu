# 十三闲鱼监控助手授权服务

Cloudflare Worker + D1 的最小授权服务。首次激活把激活码绑定到设备指纹，默认从激活时起有效 30 天。

Windows 一键部署：双击 `deploy-license.bat`，在 Cloudflare 官方页面确认授权。脚本会创建或复用 D1 数据库、初始化表结构、设置随机管理员密钥、部署 Worker、执行健康检查，并在桌面生成第一张 30 天月卡和部署结果。

部署时创建 D1 数据库、执行 `schema.sql`，把数据库 ID 写入 `wrangler.toml`，再设置 `ADMIN_TOKEN` Secret。客户端通过 `XIANYU_LICENSE_SERVER=https://你的Worker域名` 连接。

管理员创建月卡：

```bash
curl -X POST https://你的Worker域名/v1/admin/licenses \
  -H "Authorization: Bearer 你的ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"duration_days":30,"plan":"monthly"}'
```

接口只保存激活码哈希、设备指纹、激活及到期时间，不接收闲鱼账号、Cookie 或用户文件。
