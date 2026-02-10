Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    avatarUrl: {
      type: String,
      value: ''
    }
  },

  data: {
    internalShow: false,
    nickName: ''
  },

  observers: {
    show(val) {
      this.setData({ internalShow: val })
    }
  },

  methods: {
    onNickNameInput(e) {
      this.setData({ nickName: e.detail.value })
    },

    onClose() {
      this.setData({ internalShow: false, nickName: '' })
      this.triggerEvent('close')
    },

    onCancel() {
      this.onClose()
    },

    onConfirm() {
      const nickName = (this.data.nickName || '').trim()
      if (!nickName) {
        wx.showToast({ title: '昵称不能为空', icon: 'none' })
        return
      }
      this.setData({ internalShow: false })
      this.triggerEvent('confirm', {
        nickName,
        avatarUrl: this.data.avatarUrl || ''
      })
      this.setData({ nickName: '' })
    }
  }
})
