# ServerMonitor

サーバーにpingを飛ばしてサーバーの状態(advertisement)を取得し、
いい感じに表示するプログラムです。
統合版のみ対応しています。

## Config

### addresses

監視するサーバーを設定します
例:

```json
addresses: {
    {
    'host': 'testserver.com',
    'port': 19132
    } //,
    // ... more
}
```

### ping_rate

pingする間隔です(ms)

### render_rate

画面を更新する間隔です(ms)

### global_event_lifetime

グローバルイベントの最大表示時間です(ms)

### server_event_lifetime

サーバーイベントの最大表示時間です(ms)
