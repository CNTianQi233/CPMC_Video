# チルノのパーフェクトさんすう教室 · MV

《琪露诺的完美算数教室》（IOSYS）的程序化 MV。所有画面都由 Canvas 2D 实时绘制：
歌词在运行时从 `assets/lyrics.lrc` 解析（日文原文 + 中文翻译，带卡拉 OK 擦除效果），
动画随音乐节拍（自动检测为 175 BPM）同步。

画面里没有直接描绘琪露诺本人，而是由原创吉祥物「キューブ先生」（戴学士帽的冰块老师）出演。

## 准备素材

歌曲和歌词受版权保护，没有放进仓库。请自备并放到：

- `assets/song.mp3`：音源（本 MV 按 4:38 的原版时长制作）
- `assets/lyrics.lrc`：LRC 歌词（支持"原文 + 翻译"成对的格式）

`assets/analysis.json`（节拍和能量数据）已经提交；换了音源的话，用
`python3 tools/analyze_audio.py` 重新生成。

## 观看

- **成品视频**：`node tools/render.mjs` 生成 `out/cirno_mv.mp4`（1920×1080、30 fps、H.264 + AAC）
- **浏览器实时播放**：

  ```sh
  python3 -m http.server 8080
  # 打开 http://localhost:8080/
  ```

  空格：播放/暂停；← / →：后退/前进 5 秒；F：全屏。
  URL 参数：`?t=90` 从第 90 秒开始；`?offset=0.3` 让歌词整体提前 0.3 秒（负数为延后）。

## 重新渲染

需要 Node 18+、带 libx264 的 ffmpeg、Playwright + Chromium
（`npm install && npx playwright install chromium`）。

```sh
node tools/render.mjs                                    # 整首 → out/cirno_mv.mp4
node tools/render.mjs --from 23 --to 45 --out out/part.mp4   # 只渲染一段
node tools/render.mjs --stills 30,90,150                 # 导出 PNG 静帧到 out/stills/
```

其他参数：`--fps 30`、`--workers 4`（并行的浏览器页数）、`--crf 18`、`--preset medium`。

换歌词或修改时间轴后，浏览器版直接生效；视频需要重新渲染。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `index.html` / `src/player.js` | 浏览器播放器（音频同步、进度条、全屏），`?render=1` 时为离线渲染模式 |
| `src/mv.js` | 入口：加载歌词与音频特征，组合场景、歌词与转场 |
| `src/scenes.js` | 分镜时间轴与每个场景的绘制（全部是时间 `t` 的纯函数，可任意跳转） |
| `src/lyrics.js` | 歌词渲染：底部字幕、副歌大字、Rap 砸字、数字逐拍弹出 |
| `src/lrc.js` | LRC 解析（自动识别"原文 + 翻译"成对格式、合并同时间戳行） |
| `src/mascot.js` | 原创吉祥物「キューブ先生」 |
| `src/gfx.js` | 绘图工具（描边文字、⑨ 徽章、雪花、光晕、印章……） |
| `src/features.js` | 读取预计算的音频特征（节拍、低频、频谱） |
| `tools/render.mjs` | 用无头 Chromium 逐帧截取画面，送入 ffmpeg 合成视频 |
| `tools/analyze_audio.py` | 生成 `assets/analysis.json`（BPM / 节拍相位 / 能量包络 / 频谱，需要 numpy） |
| `tools/build_fonts.py` | 从 Google Fonts 下载字体并按用到的字符子集化（需要 fonttools、brotli） |
| `assets/` | 歌曲、歌词、音频特征、子集化字体 |

## 分镜

| 时间 | 场景 |
| --- | --- |
| 0:00 | 教室黑板：粉笔写出标题和制作人员，冰块老师登场；黑板上的算式答案全都是 9 |
| 0:11 | 旋转的钻石与星光 → ⑨ 奖牌 → 领奖台 |
| 0:23 | 副歌：大字歌词随拍跳动，⑨ 徽章环绕，背景每两拍换色 |
| 0:45 | 巴士应用题：巴士在雪原上停靠三站，乘客上下车（还有"半个人"），左上角黑板实时列算式 → 「0人」印章 → 巴士消失 |
| 1:07 | 舞台聚光灯，1 · 2 · ⑨ 逐拍弹出 |
| 1:17 | 三根指针狂转的闹钟 + 漩涡背景，老师转晕了；练习卷满天飞，最后房间结冰、指针停下 |
| 1:40 | 副歌（棋盘地面 + 两只跳跃的老师） |
| 2:01 | 壶的应用题：标价百万的壶碎裂、药箱赔款、躲在台座后吹口哨的兔子、乱跳的计算器 → 「0円」→ 壶从未存在 |
| 2:23 | 宇宙：公式环绕冰晶，老虎机滚轮依次停在 1 · 2 · 9 |
| 2:34 | 弹幕刷屏、打地鼠兔子、播放量涨到 100 万 |
| 2:54 | 服务器过载 → 间奏：圆形频谱 + "PERFECT MODE" 读条 |
| 3:07 | Rap：逐字砸入的大字歌词与镜头震动，书 / 灯泡 / 饭碗 / 王冠，最后 PERFECT! |
| 3:29 | 位数不断增加的巨大数字，「9点」印章 |
| 3:35 | 舞台（烟花版） |
| 3:45 | 闹钟（紫色版） |
| 4:08 | 最终副歌（满屏彩纸） |
| 4:29 | 结尾：9 分的考卷、「おしまい」、淡出 |

## 说明

- LRC 的时间戳精度只有 1 秒，所以歌词同步是近似的；可以用 `?offset=` 微调，
  或者把 `assets/lyrics.lrc` 换成更精确的版本（格式不变即可）。
- 歌曲与歌词的版权归原权利人所有，所以仓库里不包含音源、歌词和渲染好的视频。
- 字体均为 SIL Open Font License 1.1：Zen Maru Gothic、ZCOOL KuaiLe、Dela Gothic One。
