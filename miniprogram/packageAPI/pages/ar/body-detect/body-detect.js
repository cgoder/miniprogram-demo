import glBehavior from './glBehavior'
// import vkBehavior from './vkBehavior'

const info = wx.getSystemInfoSync()

Component({
  behaviors: [glBehavior],
  data: {
    theme: 'light',
  },
  lifetimes: {
    /**
     * 生命周期函数--监听页面加载
     */
    detached() {
      initShadersDone = false
      console.log("页面detached")
      if (wx.offThemeChange) {
        wx.offThemeChange()
      }
    },
    ready() {
      console.log("页面准备完全")
      this.setData({
        theme: wx.getSystemInfoSync().theme || 'light'
      })

      if (wx.onThemeChange) {
        wx.onThemeChange(({
          theme
        }) => {
          this.setData({
            theme
          })
        })
      }
    },
  },


  methods: {
    calcSize(width, height, pixelRatio) {
      console.log(`canvas size: width = ${width} , height = ${height}`)
      this.canvas.width = width * info.pixelRatio / 2
      this.canvas.height = height * info.pixelRatio / 2
      this.setData({
        width,
        height,
      })
    },
    onShow() {
      console.log('---onShow---')
    },
    onHide() {
      console.log('---onHide---')
    },
    onReady() {
      console.log('---onReady---')
      wx.createSelectorQuery()
        .select('#webgl')
        .node()
        .exec(res => {
          this.canvas = res[0].node

          this.calcSize(info.windowWidth, info.windowHeight * 0.8)

          this.initGLThree(this.canvas)
          this.initVK()
        })
    },
    onUnload() {
      console.log('---onUnload---')
      this.disposeVK()
      this.disposeGLThree(this.canvas)
    },
    initVK() {
      //检查vk支持情况
      const isSupportV1 = wx.isVKSupport('v1')
      const isSupportV2 = wx.isVKSupport('v2')
      console.log("---VK support--- v1: v2: ", isSupportV1, isSupportV2)

      if (!isSupportV1 && !isSupportV2) {
        console.error("---VK not support!--- v1: v2: ", isSupportV1, isSupportV2)
        return
      }

      //初始化vk
      if (isSupportV2) {
        this.session = wx.createVKSession({
          version: 'v2',
          track: { plane: { mode: 3 }, body: { mode: 1 } },
          cameraPosition: 1,
          // gl: glContext,  
        })
      } else if (isSupportV1) {
        this.session = wx.createVKSession({
          version: 'v1',
          track: { plane: { mode: 3 }, body: { mode: 1 } },
          cameraPosition: 1,
          // gl: glContext,  
        })
      } else {
        console.log("---VK not support!--- v1: v2: ", isSupportV1, isSupportV2)
        return
      }

      if (this.session == null) {
        console.log("---VK creat fail!--- v1: v2: ", isSupportV1, isSupportV2)
        return
      }

      //注册回调
      this.session.on('resize', (res) => {
        console.log('@@@@@@@@ VKSession.resize', res)
        const info = wx.getSystemInfoSync()
        calcSize(info.windowWidth, info.windowHeight * 0.8, info.pixelRatio)
      })
      this.session.on('addAnchors', anchors => {
        this.data.anchor2DList = anchors.map(anchor => ({
          points: anchor.points,
          origin: anchor.origin,
          size: anchor.size,
          score: anchor.score,
          confidence: anchor.confidence,
          // points3d: anchor.points3d,
          // camExtArray: anchor.camExtArray,
          // camIntArray: anchor.camIntArray,
        }))
        console.log('@@@@@@@@ VKSession.addAnchors', this.data.anchor2DList)
        // console.log("显示data")
        // console.log(this.data)
      })
      this.session.on('updateAnchors', anchors => {
        // this.session.update3DMode({open3d: true})
        this.data.anchor2DList = []
        this.data.anchor2DList = this.data.anchor2DList.concat(anchors.map(anchor => ({
          points: anchor.points,
          origin: anchor.origin,
          size: anchor.size,
          score: anchor.score,
          confidence: anchor.confidence,
          // points3d: anchor.points3d,
          // camExtArray: anchor.camExtArray,
          // camIntArray: anchor.camIntArray,
        })))
        // console.log('@@@@@@@@ VKSession.updateAnchors. personCount:', this.data.anchor2DList.length)

        // console.log("显示data")
        // console.log(this.data)
      })
      this.session.on('removeAnchors', anchors => {
        // console.log('@@@@@@@@ VKSession.removeAnchors. personCount:', p)
        this.data.anchor2DList = []
      })

      //开启vk
      this.startVK()
    },
    disposeVK() {
      if (this.session) {
        this.stopVK()
        this.session.destroy()
        this.session = null
      }
      if (this.anchor2DList) {
        this.anchor2DList = []
      }
    },
    startVK() {
      if (!this.session) {
        console.error('startVK fail!')
        return
      }

      this.session.start(err => {
        if (err) return console.error('VK error: ', err)

        console.log('@@@@@@@@ VKSession :', this.session)

        //限制调用帧率
        let fps = 25
        let fpsInterval = 1000 / fps
        let last = Date.now()

        // 逐帧渲染
        const onFrame = timestamp => {
          let now = Date.now()
          const mill = now - last
          if (mill > fpsInterval) {
            last = now - (mill % fpsInterval); //校正当前时间

            const frame = this.session.getVKFrame(this.canvas.width, this.canvas.height)
            // if (this.data.anchor2DList.length > 0) 
            {
              // this.cleanGL()
              // //绘制图像帧threejs
              if (frame) {
                // console.log('@@@@@@@@ VKSession.onFrame', this.data.anchor2DList)
                this.drawFrame(frame)
              }
              //画关键点gl
              this.drawPerson(this.data.anchor2DList)
            
            }
          }
          // this.session.cancelAnimationFrame(this.vkRequstId)
          this.vkRequstId = this.session.requestAnimationFrame(onFrame)
          // console.log('---reqId: ', this.vkRequstId)
        }
        this.vkRequstId = this.session.requestAnimationFrame(onFrame)
        console.log('---vk reqId: ', this.vkRequstId)
      })

      this.initCamera()

    },
    stopVK() {
      if (this.session) {
        if (this.vkRequstId) {
          this.session.cancelAnimationFrame(this.vkRequstId)
        }
        this.session.stop()
        this.session.off('resize')
        this.session.off('addAnchors')
        this.session.off('updateAnchors')
        this.session.off('removeAnchors')
      }
    },

    initCamera() {
      try {
        this.camera = wx.createCameraContext(this);
      } catch (e) {
        console.error('init camera err!')
      }
      console.log(`cameraContext:`, this.camera);

      // // this.fpsHelper = new FpsHelper();
      // this.cameraListener = this.camera.onCameraFrame(frame => {
      //   // const fps = this.fpsHelper.getAverageFps();
      //   // console.log(`fps`,fps);
      //   console.log(`camera onFrame`, frame.width, frame.height);
      //   // }
      // });
      // this.cameraListener.start();
      // // this.fpsHelper.reset();
    },
    snapshotCamera() {
      console.log(`snapshotCamera:`, this.camera);
      this.camera.takePhoto({
        quality: 'normal',
        success: (res) => {
          console.log('camera snapshot success: ', res)
        },
        fail: (res) => {
          console.log('camera snapshot fail: ', res)
        },
      })
    },
    startCameraRecord() {
      this.camera.startRecord({
        timeout: 60 * 1, // 1 min
        success: (res) => {
          console.log('camera start record success: ', res)
        },
        fail: (res) => {
          console.log('camera start record fail: ', res)
        },
        timeoutCallback: (res) => {
          console.log('camera start record timeoutCallback: ', res)
        },
      })
    },
    stopCameraRecord() {
      this.camera.stopRecord({
        compressed: false, // 启动视频压缩，压缩效果同chooseVideo
        success: (res) => {
          console.log('camera stop record success: ', res)
          resolve(res)
        },
        fail: (res) => {
          console.log('camera stop record fail: ', res)
        },
      })
    },

    onTouchEnd(evt) {
      console.log('---touch screen----')
      this.snapshotCamera()
    }
  },
})