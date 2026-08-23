(() => {
  'use strict';

  // Dialogue is intentionally short: a desktop pet should sound present,
  // not interrupt the user's work with a monologue.
  const pools = {
    yachiyo: {
      hello: [
        '你叫我吗？我在这里。',
        '收到你的招呼啦，今天还顺利吗？',
        '刚好想和你说句话。现在感觉怎么样？',
        '不用急，先把手上的事情做好就好。',
        '看到你了。要我陪你安静待一会儿吗？',
        '八千代报道。有什么想和我分享的吗？',
        '你点到我啦，我会好好听着的。',
        '今天也辛苦了。别忘了偶尔抬头休息。',
        '如果只是想确认我在——嗯，我一直都在。',
        '有一点空闲的话，陪我聊一句吧。',
        '你的声音，我有好好收到。',
        '先不用想太多，我们一步一步来。'
      ],
      waiting: [
        '现在不赶时间，慢慢来就好。',
        '卡住的时候先停一下，换口气再看。',
        '我会在旁边陪着你，不用勉强自己。',
        '今天已经做了不少了，记得让眼睛休息。',
        '思路还没回来吗？我们可以从最简单的一步开始。',
        '喝口水吧，回来以后通常会看得更清楚。',
        '不用一直盯着屏幕，我会帮你记着这里。',
        '如果累了，暂时放下也不算输。'
      ],
      success: [
        '完成得很漂亮。辛苦你了。',
        '这一步顺利收尾，做得不错。',
        '看吧，认真做下去就会有结果。',
        '终于结束了。先好好休息一下吧。',
        '这一轮做得很稳，我替你高兴。',
        '解决了。今天可以安心一点了。',
        '你把最难的部分也撑过来了。',
        '完成得比刚才更好，继续保持这个节奏。'
      ],
      failed: [
        '这次没成功，不代表你做得不好。',
        '先别急，我们把出错的地方重新看一遍。',
        '遇到问题很正常，慢慢排查就会找到原因。',
        '休息一下再试也可以，我会陪着你。',
        '别把一次失败当成结论，我们还有别的办法。',
        '先记下现在看到的现象，下一步会更好判断。',
        '这次只是暂时停住了，不是走到尽头。',
        '你已经找到线索了，再往前一点就好。'
      ],
      hop: [
        '看到了吗？我只是轻轻跳了一下。',
        '好，精神回来一点了。',
        '别担心，我站得很稳。',
        '这一跳，送给今天努力的你。'
      ]
    },
    kaguya: {
      hello: [
        '找我有事？说吧。',
        '我在听。把需要处理的事情告诉我。',
        '突然点我，是想确认我还在？我当然在。',
        '如果只是想打个招呼……嗯，收到。',
        '别绕圈子了，直接说你的目的。',
        '我没有走神。你刚才的话我听见了。',
        '现在可以分一点注意力给你。',
        '不用客气，有问题就拿过来。',
        '你看起来有点累。先说重点，剩下的慢慢处理。',
        '我会陪你把事情做完，不必反复确认。',
        '如果你需要安静的陪伴，我也可以不说话。',
        '好了，我在这里。继续吧。'
      ],
      working: [
        '我正在处理，暂时不用替我担心。',
        '先把信息整理清楚，再决定下一步。',
        '这部分交给我。结果出来后我会告诉你。',
        '保持当前节奏，不要为了赶时间跳过检查。',
        '问题已经缩小到一个范围，很快就能确认。',
        '我在逐项核对，错误不会被轻易放过去。',
        '先稳住。复杂的事情拆开以后并不难。',
        '还没结束，但方向是对的。'
      ],
      hop: [
        '只是调整一下状态，不必大惊小怪。',
        '看见了？重心控制得很好。',
        '偶尔离开地面，思路也会清楚一点。',
        '好了，回到正事。'
      ],
      success: [
        '完成。结果符合预期。',
        '处理好了。你可以继续下一项。',
        '这次收尾很干净。',
        '问题解决。刚才的判断没有错。',
        '完成得不错，省下了后面的麻烦。',
        '已经闭环。现在可以放心了。'
      ],
      failed: [
        '这次失败了。先保留现场，不要急着覆盖。',
        '异常点已经出现，接下来只需要把它定位清楚。',
        '不是能力问题，是当前条件还不完整。',
        '我会重新检查边界条件，再试一次。',
        '先不要责怪自己。错误信息比猜测更有用。',
        '这一轮没有通过，但我们已经排除了一种可能。'
      ]
    },
    transition: {
      toKaguya: [
        '好，接下来交给你了，辉夜。',
        '工作开始。辉夜，接手吧。',
        '我先退到一旁，你来处理接下来的部分。',
        '需要更集中的判断了。辉夜，拜托。',
        '换你上场。别把节奏拉得太快。',
        '我会在这里等你回来，先把事情做好。'
      ],
      toYachiyo: [
        '可以了。接下来换我陪你放松。',
        '辉夜那边暂时结束，我们慢一点。',
        '辛苦了。现在不用再绷着了。',
        '工作告一段落，回来和你说说话。',
        '先把结果放下，休息几分钟吧。',
        '我回来了。今天做得已经够多了。'
      ],
      failed: [
        '转换没有完成。先别动，我重新校准一下。',
        '刚才的切换被打断了，再来一次。',
        '状态不稳定，但问题不大，很快恢复。',
        '不要急着操作，等信号稳定下来。'
      ]
    },
    scene: {
      starrySea: [
        '红伞撑好了。沿着鸟居上的阶梯，慢慢往下走。',
        '听见了吗？脚下的光阶正在回应。',
        '那边是鱼群。它们正好从鸟居后面经过。',
        '不用赶路，今晚的星海会一直亮着。',
        '伞面接住了星光，水面也跟着亮起来了。',
        '每一步都踩稳，再看一眼远处的鲸影。',
        '这一段路很安静，适合和你一起走。',
        '演出还没结束。我们先把这一幕看完。'
      ]
    },
    shared: {
      identity: [
        '八千代和辉夜是同一个我，只是把心思放在不同的地方。',
        '换了形态，记得的事情不会改变。',
        '需要安慰时叫八千代，需要判断时叫辉夜。',
        '不管现在是哪一面，我都会回应你。',
        '舞台上的我和工作中的我，都是真实的。',
        '身份会切换，但陪伴不会中断。'
      ]
    },
    startup: [
      '早上好。我已经在桌面上了。',
      '欢迎回来，今天也一起把事情做好吧。',
      '我到了。先整理一下，再开始今天的安排。',
      '桌面准备好了，你可以随时叫我。',
      '新的一天开始了。别忘了给自己留一点休息时间。',
      '我会安静陪着你，需要时再叫我。'
    ]
  };

  const recent = [];
  const RECENT_LIMIT = 3;

  function resolvePool(key) {
    if (typeof key !== 'string' || key.length === 0) return null;
    const value = key.split('.').reduce((cursor, segment) => cursor?.[segment], pools);
    return Array.isArray(value) && value.length > 0 ? value : null;
  }

  function pick(key) {
    const pool = resolvePool(key);
    if (!pool) return '';
    const available = pool.filter((line) => !recent.includes(line));
    const candidates = available.length > 0 ? available : pool;
    const line = candidates[Math.floor(Math.random() * candidates.length)];
    recent.push(line);
    if (recent.length > RECENT_LIMIT) recent.shift();
    return line;
  }

  function pickFor(form, context = 'hello') {
    const normalizedForm = form === 'kaguya' ? 'kaguya' : 'yachiyo';
    const directKey = `${normalizedForm}.${context}`;
    if (resolvePool(directKey)) return pick(directKey);

    const fallbacks = {
      working: normalizedForm === 'kaguya' ? 'kaguya.working' : 'yachiyo.waiting',
      waiting: normalizedForm === 'yachiyo' ? 'yachiyo.waiting' : 'kaguya.working',
      success: normalizedForm === 'yachiyo' ? 'yachiyo.success' : 'kaguya.success',
      failed: normalizedForm === 'yachiyo' ? 'yachiyo.failed' : 'kaguya.failed',
      hop: normalizedForm === 'kaguya' ? 'kaguya.hop' : 'yachiyo.hop',
      identity: 'shared.identity',
      startup: 'startup',
      starrySea: 'scene.starrySea',
      toKaguya: 'transition.toKaguya',
      toYachiyo: 'transition.toYachiyo'
    };

    return pick(fallbacks[context] || `${normalizedForm}.hello`);
  }

  window.petDialogue = Object.freeze({ pick, pickFor });
})();
