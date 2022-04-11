// ==UserScript==
// @name        刷课辅助
// @namespace
// @match     *://course.sceouc.cn/CourseStudy.ashx*
// @grant       none
// @version     0.2
// @author      -
// @description 2021/4/10下午4:02:51
// @run-at document-start
// @namespace
// ==/UserScript==

const hackIn = () => {
  // 劫持addEventListener方法
  const _addEvent = window.addEventListener;
  window.addEventListener = (ename, evt, opt) => {
    const blackList = ['blur', 'ended'];
    if (typeof opt !== 'object' || typeof opt !== 'boolean') {
      // 第三个参数如果不传就给个默认
      opt = {
        capture: false,
        once: false,
        passive: false
      };
    }
    if (typeof evt !== 'function') {
      return;
    }
    if (blackList.includes(ename)) {
      // 拦截事件
      console.log(`已拦截${ename}事件`);
      return;
    }
    _addEvent(ename, evt, opt); // 调用原方法
  };
};

hackIn();

/**
 * 加载vue文件
 */
const loadVue = () => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '//lib.baomitu.com/vue/3.2.31/vue.global.prod.min.js';
    script.onload = () => {
      resolve();
    };
    document.head.appendChild(script);
  });
};

const renderEl = pageData => {
  const template = `
  <div id="c_video_ctrl">
    设置
    <div class="wrapper">
      <p>
        <strong>课程信息</strong>
        <div class="-wrapper-box info-wrapper">
          <span>{{courseInfo.name}}</span><br>
          <span>共{{courseInfo.total}}节，当前第{{courseInfo.current}}节，进度{{playProcess}}</span>
        </div>
      </p>
      <p>
        <strong>倍速</strong>
        <div class="-wrapper-box rate-wrapper">
          <span :class="['rate',playbackRate === item.rate ? '--active' : '']" v-for="(item,index) in playRates" :key="item.rate" @click="changeVideoStatus(item.rate,'playbackRate')">{{item.rate}}倍速</span> 
        </div>
      </p>
      <p>
        <strong>静音</strong>
        <div class="-wrapper-box mute-wrapper">
          <span :class="['sound',muted === item.mute ? '--active' : '']" v-for="(item,index) in muteActions" :key="item.name" @click="changeVideoStatus(item.mute,'muted')">{{item.name}}</span>
        </div>
      </p>
      <p>
        <strong>自动下一个</strong>
        <div class="-wrapper-box auto-wrapper">
          <span :class="['sound',autoStatus === item.auto ? '--active' : '']" v-for="(item,index) in autoChoice" :key="item.name" @click="changeAuto(item.auto)">{{item.name}}</span>
        </div>
      </p>
    </div>
  </div>
  `;
  const vueRoot = document.createElement('div');
  vueRoot.id = '__vue-root';
  document.body.appendChild(vueRoot);
  let playTimer = null;
  let jumpTimer = null;
  const app = Vue.createApp({
    el: '#c_video_ctrl',
    template: template,
    data() {
      return {
        playbackRate: 2,
        playRates: [
          {
            rate: 1
          },
          {
            rate: 1.25
          },
          {
            rate: 1.5
          },
          {
            rate: 1.75
          },
          {
            rate: 2
          }
        ],
        muted: true,
        muteActions: [
          {
            name: '静音',
            mute: true
          },
          {
            name: '不静音',
            mute: false
          }
        ],
        autoStatus: true,
        autoChoice: [
          {
            name: '是',
            auto: true
          },
          {
            name: '否',
            auto: false
          }
        ],
        courseInfo: {},
        playProcess: 0
      };
    },
    computed: {},
    watch: {
      autoStatus: {
        handler(newVal) {
          const { video } = this.pageData;
          if (!video) return;
          if (newVal) {
            console.log('ended事件监听');
            video.onended = this.handleVideoEnd;
          } else {
            console.log('ended事件取消监听');
            video.onended = null;
          }
        },
        immediate: true
      }
    },
    methods: {
      changeVideoStatus(value, type) {
        this[type] = value;
        this.pageData.video[type] = value;
      },
      changeAuto(auto) {
        this.autoStatus = auto;
      },
      getCourseInfo() {
        const { course, courseList } = this.pageData.courseInfo;
        if (!course) {
          return;
        }
        // 正则匹配《》中的内容
        const reg = /《(.*)》/;
        const result = reg.exec(course.innerText);

        let currentIndex = 0;
        const courses = Array.from(courseList).map((item, index) => {
          const { className } = item;
          if (className.includes('current')) currentIndex = index;
          const { href, innerText } = item.children[0];
          return {
            name: innerText,
            url: href
          };
        });

        this.courseInfo = {
          name: result[1],
          url: course.href,
          current: currentIndex + 1,
          total: courses.length,
          courses
        };
        console.log(this.courseInfo, 'this.courseInfo');
      },
      getVideoProcess() {
        const { playTotal, playCurrent } = this.pageData.playInfo;
        if (!playTotal || !playCurrent) {
          this.playProcess = '未知进度';
          return;
        }

        this.playProcess = `${(
          (playCurrent.innerText / playTotal.innerText) *
          100
        ).toFixed(2)}%`;
      },
      updatePlaySetting() {
        const { video } = this.pageData;
        if (!video) return;
        this.playbackRate = video.playbackRate;
        this.muted = video.muted;
      },
      init() {
        this.pageData.video.playbackRate = this.playbackRate; // 设置倍速
        this.pageData.video.muted = this.muted; // 设置静音
        playTimer = setInterval(() => {
          this.getVideoProcess();
          this.updatePlaySetting();
        }, 1000);
      },
      goNext() {
        const { current, courses } = this.courseInfo;
        location.href = courses[current].url; // current-1是当前课程下标，current是下一节课程下标
      },
      handleVideoEnd() {
        debugger;
        jumpTimer = setTimeout(() => {
          console.log('jump');
          this.goNext();
        }, 3000);
      }
    },
    mounted() {
      this.getCourseInfo();
      const { video } = this.pageData;
      if (!video) {
        // 当前页面没有视频容器
        try {
          setTimeout(() => {
            this.goNext();
          }, 1000);
        } catch (e) {
          console.log(e, '跳转失败');
        }
      } else {
        this.init();
      }
    },
    unmouted() {
      clearInterval(playTimer);
      clearTimeout(jumpTimer);
    }
  });
  app.config.globalProperties.pageData = pageData;
  app.mount(vueRoot);
};

const renderStyle = function () {
  const styles = `
  #c_video_ctrl {
    width: 50px;
    height: 50px;
    border-radius: 10px;
    position: fixed;
    right: 50px;
    top: 20px;
    z-index: 999;
    text-align: center;
    line-height: 50px;
    font-size: 18px;
    color: #ff8864;
    border: 2px solid #ff8864;
  }
  #c_video_ctrl .wrapper{
    width: 400px;
    height: auto;
    border-radius: 10px;
    position: absolute;
    right: -2px;
    top: -2px;
    z-index: 1000;
    background: #eee;
    display: none;
    color: #000;
    padding-bottom: 30px;
  }
  #c_video_ctrl:hover .wrapper{
    display: block;
  }
  #c_video_ctrl .wrapper p {
    display: flex;
    height: max-content;
    padding: 10px 15px;
    margin: 0;
    flex-wrap: wrap;
    justify-content: space-around;
  }

  #c_video_ctrl .wrapper p strong {
    width: 100%;
    font-size: 18px;
  }
  #c_video_ctrl .wrapper p span {
    font-size: 16px;
    cursor: pointer;
    padding: 0 10px;
    color: #333;
  }
  #c_video_ctrl .wrapper p span:hover{
    color: #ff8864;
  }
  #c_video_ctrl .wrapper p span.--active{
    color: #ff8864;
    border: 2px solid #ff8864;
    border-radius: 1em;
  }
  .-wrapper-box{
    line-height: 1.5em;
  }
  `;
  const style = document.createElement('style');
  style.innerHTML = styles;
  document.head.appendChild(style);
};

const collectData = _ => {
  const pageData = {}; // 存储页面数据

  return new Promise((resolve, reject) => {
    const courseList = document.querySelectorAll('.olitem'); // 课程列表
    if (!courseList.length) {
      reject();
    }

    const video = document.querySelector('#ckplayer_videobox'); // 视频元素
    pageData.video = video;
    const course = document.querySelector('.courseBox > a'); // 课程基本信息
    pageData.courseInfo = {
      course,
      courseList
    };
    const playTotal = document.querySelector('#totalTime'); // 视频总时长
    const playCurrent = document.querySelector('#playTime'); // 视频当前播放时长
    pageData.playInfo = {
      playTotal,
      playCurrent
    };

    resolve(pageData);
  });
};

const myLoad = () => {
  console.log(location.href);
  collectData()
    .then(pageData => {
      loadVue().then(() => {
        renderStyle();
        renderEl(pageData);
      });
    })
    .catch(() => {
      console.log('没有在当前页面上找到课程列表');
    });
};

window.addEventListener('load', myLoad);
