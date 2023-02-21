# ServerMonitor

サーバーにpingを飛ばしてサーバーの状態(advertisement)を取得し、
いい感じに表示するプログラムです。
統合版のみ対応しています。
![image](https://user-images.githubusercontent.com/70795425/220373069-4778f23c-7160-45ba-9490-bc83417bb3bd.png)

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
