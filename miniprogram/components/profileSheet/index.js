const { updateUserInfo } = require('../../utils/userinfo')

Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    avatarUrl: {
      type: String,
      value: ''
    },
    nickName: {
      type: String,
      value: ''
    }
  },

  data: {
    internalShow: false,
    inputNickName: '',
    saving: false
  },

  observers: {
    show(val) {
      this.setData({ internalShow: val })
      // 弹窗打开时，用外部传入的昵称作为初始值
      if (val) {
        this.setData({ inputNickName: this.data.inputNickName || this.properties.nickName || '' })
      }
    }
  },

  methods: {
    onNickNameInput(e) {
      this.setData({ inputNickName: e.detail.value })
    },

    onClose() {
      this.setData({ internalShow: false, inputNickName: '', saving: false })
      this.triggerEvent('close')
    },

    onCancel() {
      this.onClose()
    },

    async onConfirm() {
      if (this.data.saving) return

      const nickName = (this.data.inputNickName || '').trim()
      if (!nickName) {
        wx.showToast({ title: '昵称不能为空', icon: 'none' })
        return
      }

      this.setData({ saving: true })

      const payload = {
        nickName,
        avatarUrl: this.data.avatarUrl || ''
      }

      try {
        const res = await updateUserInfo(payload)

        if (res && res.success && res.data) {
          const { openId, nickName: finalNickName, avatarUrl: finalAvatarUrl } = res.data
          const mergedUserInfo = {
            nickName: finalNickName || payload.nickName,
            avatarUrl: finalAvatarUrl || payload.avatarUrl
          }

          wx.showToast({ title: '保存成功', icon: 'success' })

          this.setData({ internalShow: false, inputNickName: '', saving: false })

          // 通知父页面：已保存成功，并返回最终的用户信息和 openId（如果有）
          this.triggerEvent('confirm', {
            userInfo: mergedUserInfo,
            openId: openId || ''
          })
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
          this.setData({ saving: false })
          console.error('更新用户信息失败:', res)
        }
      } catch (e) {
        wx.showToast({ title: '保存失败', icon: 'none' })
        this.setData({ saving: false })
        console.error('更新用户信息异常:', e)
      }
    }
  }
})
