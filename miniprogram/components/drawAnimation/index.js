Component({
  properties: {
    // 模板配置
    template: {
      type: Object,
      value: {}
    },
    // 是否自动开始
    autoStart: {
      type: Boolean,
      value: false
    }
  },

  data: {
    stage: 'idle', // idle/shaking/flying/revealed
    shakeClass: '',
    flyClass: '',
    revealClass: '',
    hintClass: '',
    hintText: '点击竹筒求签',
    resultType: 'neutral', // punish/reward/neutral
    resultNumber: 1,
    resultLabel: '',
    resultIcon: '',
    resultDesc: '',
    particles: [],
    innerRotate: 0
  },

  lifetimes: {
    attached() {
      if (this.data.autoStart) {
        this.startDraw();
      }
      this.generateParticles();
    }
  },

  methods: {
    // 生成氛围粒子
    generateParticles() {
      const icons = this.data.template.id === 'dishwasher' ? ['🧽', '💦', '🍽️'] : ['✨', '🎋', '🔮'];
      const particles = [];
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: Math.random() * 80 + 10,
          y: Math.random() * 60 + 20,
          delay: Math.random() * 2,
          icon: icons[Math.floor(Math.random() * icons.length)]
        });
      }
      this.setData({ particles });
    },

    // 开始抽签动画
    async startDraw() {
      if (this.data.stage !== 'idle') return;
      
      this.setData({ 
        stage: 'shaking',
        shakeClass: 'shake-hard',
        hintText: '签筒摇晃中...',
        hintClass: 'show'
      });

      // 阶段1：摇晃800ms
      await this.sleep(800);
      
      // 阶段2：签条抖动（内部动画）
      this.setData({ 
        innerRotate: 15,
        hintText: '签文即将揭晓...'
      });

      await this.sleep(400);

      // 调用云函数获取结果（实际应在父页面调用，这里用事件通知）
      this.triggerEvent('onDrawStart');
    },

    // 接收结果并播放后续动画（由父页面调用）
    showResult(resultData) {
      const { number, type, label, icon, desc } = resultData;
      
      // 阶段3：签条飞出
      this.setData({
        stage: 'flying',
        shakeClass: '',
        flyClass: 'fly-out',
        resultNumber: number,
        resultType: type,
        resultLabel: label,
        resultIcon: icon,
        resultDesc: desc,
        hintText: '签文显现！'
      });

      // 震动反馈
      if (type === 'punish') {
        wx.vibrateLong(); // 长震动表示"倒霉"
      } else {
        wx.vibrateShort({ type: 'heavy' }); // 短震动表示"幸运"
      }

      // 阶段4：结果展开
      setTimeout(() => {
        this.setData({
          stage: 'revealed',
          flyClass: '',
          revealClass: 'show',
          hintText: type === 'punish' ? '愿赌服输！' : '运气爆棚！'
        });
        
        // 播放音效（如有）
        this.playSound(type);
        
        // 通知父页面动画完成
        this.triggerEvent('onDrawComplete', resultData);
      }, 600);
    },

    // 重置动画
    reset() {
      this.setData({
        stage: 'idle',
        shakeClass: '',
        flyClass: '',
        revealClass: '',
        hintText: '点击竹筒求签',
        resultType: 'neutral'
      });
    },

    // 工具函数
    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },

    playSound(type) {
      // 使用微信音频API播放音效（需提前下载音频文件）
      const audio = wx.createInnerAudioContext();
      audio.src = type === 'punish' ? '/audio/punish.mp3' : '/audio/reward.mp3';
      audio.play();
    }
  }
});