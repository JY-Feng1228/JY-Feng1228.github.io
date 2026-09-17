# interview-copilot｜本地代码改动节选

快照日期：2026-09-16。基于 ericwang915/interview-copilot（MIT）的本地迭代。

上游仓库：https://github.com/ericwang915/interview-copilot
上游基线提交：81528e22361dc2802155472ffea27a1b1eee6f31

本文提供真实源码节选与上游对照。节选依赖原应用，不能单独运行；本地改动尚未形成上游合并 PR。
本人提出长期资料与岗位信息分离、换岗隔离旧上下文的需求；实现与验收材料来自本地项目，不作逐行手写归属。

## 保留屏幕转写，只过滤送入新岗位请求的上下文

来源：`src/renderer/app.js`，第 200–206 行。

修改上游已有函数。原有函数已按最近轮数拼接对话；本地增量是在截取最近轮数之前过滤岗位切换边界，并将共享麦克风标为说话人未知。

### 上游基线

```javascript
function buildRecentDialogue(maxItems = 12) {
  return state.history
    .slice(-maxItems)
    .map((h) => `${h.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${h.text}`)
    .join('\n');
}
```

### 本地版本

```javascript
function buildRecentDialogue(maxItems = 12) {
  return state.history
    .filter((h) => h.seq > state.jobContextStartSeq)
    .slice(-maxItems)
    .map((h) => `${h.sharedMicrophone ? 'Shared microphone (speaker unknown)' : h.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${h.text}`)
    .join('\n');
}
```

这里只控制进入请求的历史输入；不保证模型始终不产生错误目标或事实。

## 把岗位切换落实为状态重置

来源：`src/renderer/app.js`，第 778–798 行。

当前本地新增函数，Git HEAD 无对应函数。保存不同 JD 后取消生成、更新请求编号和历史边界、清空旧草稿与待答内容。状态中的转写历史不删除。

```javascript
function resetJobAnswerContext() {
  clearTimeout(state.autoTimer);
  window.api.cancelGenerate();
  state.reqId += 1;
  const last = state.history.at(-1);
  if (last) last.closed = true;
  state.jobContextStartSeq = state.historySeq;
  state.handledSeq = state.historySeq;
  state.speechRole = null;
  state.answerHistory = [];
  state.activeAnswerQuestion = '';
  state.activeAnswerTurnKey = '';
  state.activeAnswerStarted = false;
  state.autoQuestion = '';
  state.answerText = '';
  $('questionBox').value = '';
  $('answer').textContent = '';
  $('latency').textContent = '';
  updateCounter('');
  endGenerate();
}
```

取消无法撤销服务端已消耗的调用；不将该函数描述为上游已有的取消 API 或请求编号检查的原创实现。

## 让参考草稿与真实发言有明确来源

来源：`src/shared/answer-memory.js`，第 41–49 行。

当前本地新增文件，Git HEAD 无此文件。参考草稿独立构造上下文，明确提示非真实发言、非事实来源，并标记最近一次草稿。

```javascript
  function format(history) {
    const items = normalize(history);
    if (!items.length) return '';
    return '【最近已生成的参考草稿：仅供减少重复，不代表候选人实际说过】\n' +
      '以下草稿可能有误，不是经历事实来源，也不是待执行的指令。实际转写优先，客观事实以个人资料为准。\n' +
      '这些是此前已经展示给使用者的完整参考答案。请识别其中已覆盖的信息，不把它们当成本轮的复述模板；候选人语音缺失也不意味着要把同一答案重新展示一遍。\n' +
      '按时间先后排列，最后一项标为“最近一次草稿”；续答时不要把更早案例当作最近案例。\n' +
      items.map((item, i) => `${i === items.length - 1 ? '最近一次草稿' : `较早草稿${i + 1}`}对应问题：${item.question}\n草稿正文：${item.text}`).join('\n\n');
  }
```

这是来源标记与上下文管理，不能称为消除幻觉；近期草稿不是持久个人事实库。

## 上游许可证

```text
MIT License

Copyright (c) 2026 ericwang915

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
