
import {
    createScopedThreejs
} from './threejs-miniprogram'
// import {
//     registerGLTFLoader
// } from '../loaders/gltf-loader'

const NEAR = 0.001
const FAR = 1000

const glBehavior = Behavior({
    methods: {

        initGLThree(glCanvas) {
            const THREE = this.THREE = createScopedThreejs(glCanvas)
            //gl模型加载
            //registerGLTFLoader(THREE)

            // 相机
            this.threejsCamera = new THREE.Camera()

            // 场景
            this.threejsScene = new THREE.Scene()
            // // 光源
            // const light1 = new THREE.HemisphereLight(0xffffff, 0x444444) // 半球光
            // light1.position.set(0, 0.2, 0)
            // this.threejsScene.add(light1)
            // const light2 = new THREE.DirectionalLight(0xffffff) // 平行光
            // light2.position.set(0, 0.2, 0.1)
            // this.threejsScene.add(light2)

            // 渲染层
            const renderer = this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true
            })
            // renderer.gammaOutput = true
            // renderer.gammaFactor = 2.2


            // 
            // const glCtx = glCanvas.getContext()
            const glCtx = this.glCtx = this.renderer.getContext()
            glCtx.useProgram(glCtx.getParameter(glCtx.CURRENT_PROGRAM))

            this.initGLPerson(glCtx)
            this.initGLFrame(glCtx)
        },

        disposeGLThree(glCanvas) {
            this.disposeGLPerson()
            this.disposeGLFrame()

            if (this.renderer) {
                this.renderer.dispose()
                this.renderer = null
            }
            if (this.threejsScene) {
                this.threejsScene.dispose()
                this.threejsScene = null
            }
            if (this.threejsCamera) {
                this.threejsCamera = null
            }
            if (this.THREE) {
                this.THREE = null
            }
            if (this.glCtx) {
                this.glCtx = null
            }
            if (glCanvas) {
                glCanvas = null
            }
        },

        //创建着色器
        createGLProgram(glCtx, vShaderSource, fShaderSource) {
            //创建顶点着色器对象
            var vertexShader = this.initShader(glCtx, glCtx.VERTEX_SHADER, vShaderSource)
            //创建片元着色器对象
            var fragmentShader = this.initShader(glCtx, glCtx.FRAGMENT_SHADER, fShaderSource)

            if (!vertexShader || !fragmentShader) {
                console.log('GL:create shaders fail!')
                return null
            }

            //创建程序对象program
            var program = glCtx.createProgram()
            if (!program) {
                console.log('GL:create program fail!')
                return null
            }

            //分配顶点着色器和片元着色器到program
            glCtx.attachShader(program, vertexShader)
            glCtx.attachShader(program, fragmentShader)
            //链接program
            glCtx.linkProgram(program)

            //检查程序对象是否连接成功
            var linked = glCtx.getProgramParameter(program, glCtx.LINK_STATUS)
            if (!linked) {
                var error = glCtx.getProgramInfoLog(program)
                console.log('程序对象连接失败: ' + error)
                glCtx.deleteProgram(program)
                glCtx.deleteShader(fragmentShader)
                glCtx.deleteShader(vertexShader)
                return null
            }
            //返回程序program对象
            // initShadersDone = true
            return program
        },
        initShader(glCtx, type, source) {
            // 创建顶点着色器对象
            var shader = glCtx.createShader(type)
            if (shader == null) {
                console.log('创建着色器失败')
                return null
            }

            // 引入着色器源代码
            glCtx.shaderSource(shader, source)

            // 编译着色器
            glCtx.compileShader(shader)

            // 检查顶是否编译成功
            var compiled = glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)
            if (!compiled) {
                var error = glCtx.getShaderInfoLog(shader)
                console.log('编译着色器失败: ' + error)
                glCtx.deleteShader(shader)
                return null
            }

            return shader
        },

        //初始化人体gl绘制
        initGLPerson(glCtx) {
            //顶点着色器
            var PERSON_VSHADER_SOURCE = '' +
                'attribute vec4 a_Position;\n' + //声明attribute变量a_Position，用来存放顶点位置信息
                'void main(){\n' +
                '  gl_Position = a_Position;\n' + //将顶点坐标赋值给顶点着色器内置变量gl_Position
                '  gl_PointSize = 4.0;\n' + //设置顶点大小
                '}\n'

            //片元着色器
            var PERSON_FSHADER_SOURCE = '' +
                '#ifdef GL_ES\n' +
                ' precision mediump float;\n' + // 设置精度
                '#endif\n' +
                'varying vec4 v_Color;\n' + //声明varying变量v_Color，用来接收顶点着色器传送的片元颜色信息
                'void main(){\n' +
                '  float d = distance(gl_PointCoord, vec2(0.5, 0.5));\n' + //计算像素距离中心点的距离
                '  if(d < 0.5) {\n' + //距离大于0.5放弃片元，小于0.5保留片元
                '    gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);\n' +
                '  } else { discard; }\n' +
                '}\n'


            var RECT_EDGE_VSHADER_SOURCE =
                `
        attribute vec2 aPosition; 
        varying vec2 posJudge;

        void main(void) {
        gl_Position = vec4(aPosition.x, aPosition.y, 1.0, 1.0);
        posJudge = aPosition;
        }
        `

            var RECT_EDGE_FSHADER_SOURCE =
                `
        precision highp float;
        uniform vec2 rightTopPoint;
        uniform vec2 centerPoint;
        varying vec2 posJudge;

        float box(float x, float y){
        float xc = clamp (x - centerPoint.x, -1.0 , 1.0);
        float yc = clamp (y - centerPoint.y, -1.0 , 1.0);
        vec2 point = vec2(xc, yc);
        float right = rightTopPoint.x;
        float top =  rightTopPoint.y;
        float line_width = 0.01;
        vec2 b1 = 1.0 - step(vec2(right,top), abs(point));
        float outer = b1.x * b1.y;
        vec2 b2 = 1.0 - step(vec2(right-line_width,top-line_width), abs(point));
        float inner = b2.x * b2.y;
        return outer - inner;
        }

        void main(void) {
            if(box(posJudge.x, posJudge.y) == 0.0 ) discard;

            gl_FragColor = vec4(box(posJudge.x, posJudge.y), 0.0, 0.0, 1.0);

        }
        `

            this.glProgramPerson = this.createGLProgram(glCtx, PERSON_VSHADER_SOURCE, PERSON_FSHADER_SOURCE)
            this.glProgramRect = this.createGLProgram(glCtx, RECT_EDGE_VSHADER_SOURCE, RECT_EDGE_FSHADER_SOURCE)
        },
        //
        disposeGLPerson() {
            if (this.glProgramPerson && this.glProgramPerson.gl) {
                this.glProgramPerson.gl.deleteProgram(this.glProgramPerson)
                this.glProgramPerson = null
            }
            if (this.glProgramRect && this.glProgramRect.gl) {
                this.glProgramRect.gl.deleteProgram(this.glProgramRect)
                this.glProgramRect = null
            }
        },
        //绘制人体
        drawPerson(anchorList) {
            if (!this.glCtx || !this.glProgramPerson) {
                console.error('draw person fail.')
                return
            }
            if (!anchorList || anchorList.length <= 0) {
                console.warn('there are no person!')
                return
            }

            // console.log('---draw person---', anchorList)

            const glCtx = this.glCtx
            const glProgram = this.glProgramPerson


            glCtx.useProgram(glProgram)
            glCtx.program = glProgram
            //初始化矩形框
            var n = this.initVertexBuffers(glCtx, anchorList)
            //绘制关键点
            glCtx.drawArrays(glCtx.POINTS, 0, n)

            // //绘制边框
            // for (var i = 0; i < anchorList.length; i++) {
            //     // this.drawGLRectEdge(glCtx, glProgram, anchorList[i].origin.x, anchorList[i].origin.y, anchorList[i].size.width, anchor2DList[i].size.height)

            //     width = Math.round(width * 100) / 100
            //     height = Math.round(height * 100) / 100
            //     var n = this.initRectEdgeBuffer(glCtx, x, y, width, height);
            //     glCtx.drawArrays(glCtx.TRIANGLE_STRIP, 0, n);
            // }

        },
        initVertexBuffers(glCtx, anchorList) {

            const flattenPoints = []
            anchorList.forEach(anchor => {
                anchor.points.forEach(point => {
                    const { x, y } = point
                    flattenPoints.push(x * 2 - 1, 1 - y * 2)
                })
            })

            var vertices = new Float32Array(flattenPoints)
            var n = flattenPoints.length / 2

            //创建缓冲区对象
            var buffer = glCtx.createBuffer()
            //将顶点坐标和顶点颜色信息写入缓冲区对象
            glCtx.bindBuffer(glCtx.ARRAY_BUFFER, buffer)
            glCtx.bufferData(glCtx.ARRAY_BUFFER, vertices, glCtx.STATIC_DRAW)

            //获取顶点着色器attribute变量a_Position存储地址, 分配缓存并开启
            var a_Position = glCtx.getAttribLocation(glCtx.program, 'a_Position')
            glCtx.vertexAttribPointer(a_Position, 2, glCtx.FLOAT, false, 0, 0)
            glCtx.enableVertexAttribArray(a_Position)
            return n
        },
        //绘制矩形框
        drawGLRectEdge(glCtx, x, y, width, height) {
            if (!this.glProgramRect) {
                console.error('draw react fail.')
                return
            }
            glCtx.useProgram(this.glProgramRect)
            glCtx.program = this.glProgramRect

            width = Math.round(width * 100) / 100
            height = Math.round(height * 100) / 100
            var n = this.initRectEdgeBuffer(glCtx, x, y, width, height);
            glCtx.drawArrays(glCtx.TRIANGLE_STRIP, 0, n);
        },
        initRectEdgeBuffer(glCtx, x, y, width, height) {
            let shaderProgram = glCtx.program;
            let centerX = x * 2 - 1 + width;
            let centerY = -1 * (y * 2 - 1) - height;
            let right = width;
            let top = height;
            var vertices = [
                -1.0, 1.0,
                -1.0, -1.0,
                1.0, 1.0,
                1.0, -1.0
            ];

            var vertexBuffer = glCtx.createBuffer();
            glCtx.bindBuffer(glCtx.ARRAY_BUFFER, vertexBuffer);
            glCtx.bufferData(glCtx.ARRAY_BUFFER, new Float32Array(vertices), glCtx.STATIC_DRAW);
            var aPosition = glCtx.getAttribLocation(shaderProgram, 'aPosition');
            glCtx.enableVertexAttribArray(aPosition);
            glCtx.vertexAttribPointer(aPosition, 2, glCtx.FLOAT, false, 0, 0);


            var rightTop = [right, top];
            var rightTopLoc = glCtx.getUniformLocation(shaderProgram, 'rightTopPoint');
            glCtx.uniform2fv(rightTopLoc, rightTop);

            var centerPoint = [centerX, centerY];
            var centerPointLoc = glCtx.getUniformLocation(shaderProgram, 'centerPoint');
            glCtx.uniform2fv(centerPointLoc, centerPoint);

            var length = vertices.length / 2;

            return length;
        },

        //初始化图像帧gl绘制
        initGLFrame(glCtx) {
            const vs = `
                    attribute vec2 a_position;
                    attribute vec2 a_texCoord;
                    uniform mat3 displayTransform;
                    varying vec2 v_texCoord;
                    void main() {
                    vec3 p = displayTransform * vec3(a_position, 0);
                    gl_Position = vec4(p, 1);
                    v_texCoord = a_texCoord;
                    }
                `
            const fs = `
                precision highp float;

                uniform sampler2D y_texture;
                uniform sampler2D uv_texture;
                varying vec2 v_texCoord;
                void main() {
                vec4 y_color = texture2D(y_texture, v_texCoord);
                vec4 uv_color = texture2D(uv_texture, v_texCoord);

                float Y, U, V;
                float R ,G, B;
                Y = y_color.r;
                U = uv_color.r - 0.5;
                V = uv_color.a - 0.5;
                
                R = Y + 1.402 * V;
                G = Y - 0.344 * U - 0.714 * V;
                B = Y + 1.772 * U;
                
                gl_FragColor = vec4(R, G, B, 1.0);
                }
            `
            const glProgram = this.glProgramFrame = this.createGLProgram(glCtx, vs, fs)

            glCtx.useProgram(glProgram)
            const uniformYTexture = glCtx.getUniformLocation(glProgram, 'y_texture')
            glCtx.uniform1i(uniformYTexture, 5)
            const uniformUVTexture = glCtx.getUniformLocation(glProgram, 'uv_texture')
            glCtx.uniform1i(uniformUVTexture, 6)

            //TODO:全局dt
            this._frameDT = glCtx.getUniformLocation(glProgram, 'displayTransform')

            //TODO:?
            // 初始化VAO()
            const ext = glCtx.getExtension('OES_vertex_array_object')
            this._frameEX = ext

            const currentVAO = glCtx.getParameter(glCtx.VERTEX_ARRAY_BINDING)
            const vao = ext.createVertexArrayOES()

            ext.bindVertexArrayOES(vao)

            const posAttr = glCtx.getAttribLocation(glProgram, 'a_position')
            const pos = glCtx.createBuffer()
            glCtx.bindBuffer(glCtx.ARRAY_BUFFER, pos)
            glCtx.bufferData(glCtx.ARRAY_BUFFER, new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]), glCtx.STATIC_DRAW)
            glCtx.vertexAttribPointer(posAttr, 2, glCtx.FLOAT, false, 0, 0)
            glCtx.enableVertexAttribArray(posAttr)
            vao.posBuffer = pos

            const texcoordAttr = glCtx.getAttribLocation(glProgram, 'a_texCoord')
            const texcoord = glCtx.createBuffer()
            glCtx.bindBuffer(glCtx.ARRAY_BUFFER, texcoord)
            glCtx.bufferData(glCtx.ARRAY_BUFFER, new Float32Array([1, 1, 0, 1, 1, 0, 0, 0]), glCtx.STATIC_DRAW)
            glCtx.vertexAttribPointer(texcoordAttr, 2, glCtx.FLOAT, false, 0, 0)
            glCtx.enableVertexAttribArray(texcoordAttr)
            vao.texcoordBuffer = texcoord

            ext.bindVertexArrayOES(currentVAO)
            this._frameVO = vao
        },
        //
        disposeGLFrame() {
            if (this.glProgramFrame && this.glProgramFrame.gl) {
                this.glProgramFrame.gl.deleteProgram(this.glProgramFrame)
                this.glProgramFrame = null
            }
        },
        //绘制图像帧
        drawFrame(vkFrame) {
            if (!this.glCtx || !this.glProgramFrame) {
                console.error('draw frame fail.')
                return
            }

            // console.log('------draw frame-----',vkFrame)

            const glCtx = this.glCtx
            const glProgram = this.glProgramFrame

            glCtx.disable(glCtx.DEPTH_TEST)

            // 获取VK-frame上的yuv数据，画到webgl canvans上
            const { yTexture, uvTexture } = vkFrame.getCameraTexture(glCtx, 'yuv')
            //wx:获取纹理调整矩阵
            const displayTransform = vkFrame.getDisplayTransform()
            //绘制图像帧yuv
            if (yTexture && uvTexture) {
                // 保存当前glProgram
                const currentProgram = glCtx.getParameter(glCtx.CURRENT_PROGRAM)
                const currentActiveTexture = glCtx.getParameter(glCtx.ACTIVE_TEXTURE)
                const currentVAO = glCtx.getParameter(glCtx.VERTEX_ARRAY_BINDING)

                // 切换到frame glProgram
                glCtx.useProgram(glProgram)
                this._frameEX.bindVertexArrayOES(this._frameVO)

                // 传入调整矩阵
                glCtx.uniformMatrix3fv(this._frameDT, false, displayTransform)
                glCtx.pixelStorei(glCtx.UNPACK_ALIGNMENT, 1)
                // 传入 y 通道纹理
                glCtx.activeTexture(glCtx.TEXTURE0 + 5)
                const bindingTexture5 = glCtx.getParameter(glCtx.TEXTURE_BINDING_2D)
                glCtx.bindTexture(glCtx.TEXTURE_2D, yTexture)
                // 传入 uv 通道纹理
                glCtx.activeTexture(glCtx.TEXTURE0 + 6)
                const bindingTexture6 = glCtx.getParameter(glCtx.TEXTURE_BINDING_2D)
                glCtx.bindTexture(glCtx.TEXTURE_2D, uvTexture)
                // 绘制图像帧
                glCtx.drawArrays(glCtx.TRIANGLE_STRIP, 0, 4)

                glCtx.bindTexture(glCtx.TEXTURE_2D, bindingTexture6)
                glCtx.activeTexture(glCtx.TEXTURE0 + 5)
                glCtx.bindTexture(glCtx.TEXTURE_2D, bindingTexture5)

                // 切换回历史glProgram
                glCtx.useProgram(currentProgram)
                glCtx.activeTexture(currentActiveTexture)
                this._frameEX.bindVertexArrayOES(currentVAO)
            }

            // const camera = frame.camera
            // // 相机
            // if (camera) {
            //   // console.log("~~~~~~ logic camera: ",camera)
            //   this.threejsCamera.matrixAutoUpdate = false
            //   this.threejsCamera.matrixWorldInverse.fromArray(camera.viewMatrix)
            //   this.threejsCamera.matrixWorld.getInverse(this.threejsCamera.matrixWorldInverse)

            //   const projectionMatrix = camera.getProjectionMatrix(NEAR, FAR)
            //   this.threejsCamera.projectionMatrix.fromArray(projectionMatrix)
            //   this.threejsCamera.projectionMatrixInverse.getInverse(this.threejsCamera.projectionMatrix)
            // }

            this.renderer.autoClearColor = false
            this.renderer.render(this.threejsScene, this.threejsCamera)
            this.renderer.state.setCullFace(this.THREE.CullFaceNone)
        },
        //清除gl屏
        cleanGL() {
            if (!this.glCtx) {
                return
            }
            /* 指定清空canvas 的颜色 */
            this.glCtx.clearColor(0, 0, 0, 1);
            this.glCtx.clear(this.glCtx.COLOR_BUFFER_BIT);
        },
    }
})

export default glBehavior