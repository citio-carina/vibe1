import { useCallback, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Axis3D,
  Box,
  Check,
  ChevronRight,
  CircleHelp,
  Crosshair,
  Expand,
  Grid3X3,
  Hand,
  Info,
  Keyboard,
  LoaderCircle,
  Maximize,
  Minus,
  MousePointer2,
  Move3D,
  Pause,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import Scene, { type SceneApi, type Telemetry } from "./Scene";
import { HOME, type ControlMode } from "./robot";
import { useRobotInput } from "./useRobotInput";

const jointNames = ["底座", "肩部", "肘部", "前臂", "腕部", "法兰"];
const jointRanges = [
  [-180, 180],
  [-90, 155],
  [-180, 180],
  [-360, 360],
  [-125, 125],
  [-360, 360],
];
export default function App() {
  const [mode, setMode] = useState<ControlMode>("elbow"),
    [speed, setSpeed] = useState(0.2);
  const [grid, setGrid] = useState(true),
    [axes, setAxes] = useState(true),
    [paused, setPaused] = useState(false);
  const [view, setView] = useState("perspective"),
    [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const [telemetry, setTelemetry] = useState<Telemetry>({
    position: [0, 0, 0],
    tool: [0, 0, 0],
    angles: HOME.map((a) => (a * 180) / Math.PI),
    boundary: false,
    moving: false,
  });
  const settings = useRef({ mode, speed, grid, axes, paused });
  settings.current = { mode, speed, grid, axes, paused };
  const api = useRef<SceneApi | null>(null),
    help = useRef<HTMLDialogElement>(null),
    source = useRef<HTMLDialogElement>(null);
  const input = useRobotInput(phase === "ready" && !paused);
  const ready = useCallback(() => setPhase("ready"), []);
  const fail = useCallback((message: string) => {
    setError(message);
    setPhase("error");
  }, []);
  const changeMode = (next: ControlMode) => {
    input.clear();
    setMode(next);
  };
  const changeView = (next: string) => {
    setView(next);
    api.current?.view(next);
  };
  const reset = () => {
    input.clear();
    api.current?.reset();
  };
  const openDialog = (dialog: HTMLDialogElement | null) => {
    input.clear();
    dialog?.showModal();
  };
  const status =
    phase === "loading"
      ? "模型加载中"
      : phase === "error"
        ? "加载失败"
        : paused
          ? "控制已暂停"
          : telemetry.boundary
            ? "已到达运动范围边界"
            : telemetry.moving
              ? "正在运动"
              : "准备就绪";
  const dpad = [
    { key: "w", label: "向上移动 Z+", Icon: ArrowUp },
    { key: "a", label: "向左移动 X−", Icon: ArrowLeft },
    { key: "s", label: "向下移动 Z−", Icon: ArrowDown },
    { key: "d", label: "向右移动 X+", Icon: ArrowRight },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <a className="brand" href="./" aria-label="机器臂实验计划1首页">
          <span className="brand-mark">
            <Move3D size={23} />
          </span>
          <span>
            机器臂<span className="brand-light">实验计划1</span>
          </span>
          <span className="version">LAB</span>
        </a>
        <div className="header-right">
          <span className="local-badge">
            <i />
            本地交互实验室
          </span>
          <button
            className="help-button"
            aria-label="使用指南"
            onClick={() => openDialog(help.current)}
          >
            <CircleHelp size={17} />
            <span>使用指南</span>
          </button>
          <span className="avatar" title="小黄黄的工作台">
            黄
          </span>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="breadcrumb">
              工作台 <ChevronRight size={12} /> 机械臂实验室
            </div>
            <h1>机器臂实验计划1</h1>
            <p>从一个关节开始，让空间中的运动直观可见。</p>
          </div>
          <div className="heading-meta">
            <span className="outline-tag">
              <Box size={14} /> 真实机器人模型
            </span>
            <span className="outline-tag">
              <ShieldCheck size={14} /> 仅仿真 · 无硬件连接
            </span>
          </div>
        </div>
        <div className="workspace">
          <section className="viewport-panel" aria-label="三维机械臂工作区">
            <div className="viewport-toolbar">
              <div className="model-title">
                <span className="model-icon">
                  <Box size={18} />
                </span>
                <div>
                  <strong>
                    FANUC R-1000iA<span className="model-variant"> / 80F</span>
                  </strong>
                  <span>六轴工业机械臂</span>
                </div>
              </div>
              <div className="view-tabs" role="group" aria-label="观察视角">
                {[
                  ["perspective", "透视"],
                  ["front", "正视"],
                  ["top", "俯视"],
                ].map(([id, name]) => (
                  <button
                    key={id}
                    aria-pressed={view === id}
                    className={view === id ? "selected" : ""}
                    onClick={() => changeView(id)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div className="viewport">
              <Scene
                settings={settings}
                keys={input.keys}
                onTelemetry={setTelemetry}
                onProgress={setProgress}
                onReady={ready}
                onError={fail}
                api={api}
                attempt={attempt}
              />
              <div className="scene-topline">
                <span
                  className={`scene-status ${telemetry.boundary ? "warning" : ""}`}
                >
                  <i />
                  {status}
                </span>
                <span className="scene-scale">WORLD / 米</span>
              </div>
              <div className="scene-caption">
                <span className="caption-rule" />
                <div>
                  <span className="caption-small">机器臂实验计划1</span>
                  <strong>看见结构，感受运动。</strong>
                </div>
              </div>
              {phase !== "ready" && (
                <div className="load-overlay">
                  <div className="load-card">
                    {phase === "loading" ? (
                      <>
                        <LoaderCircle className="spinner" size={28} />
                        <h2>正在组装机械臂</h2>
                        <p>加载模型与关节结构 · {Math.round(progress)}%</p>
                        <progress
                          aria-label="模型加载进度"
                          max="100"
                          value={progress}
                        />
                      </>
                    ) : (
                      <>
                        <Info size={28} />
                        <h2>暂时无法显示模型</h2>
                        <p role="alert">{error}</p>
                        <button
                          className="primary-button"
                          onClick={() => {
                            input.clear();
                            setPhase("loading");
                            setProgress(0);
                            setAttempt((n) => n + 1);
                          }}
                        >
                          <RotateCcw size={15} />
                          重新加载
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
              <div className="scene-bottom">
                <div
                  className="axis-gizmo"
                  aria-label="世界坐标轴：X 右，Y 深度，Z 上"
                >
                  <span className="gizmo-z">Z</span>
                  <span className="gizmo-y">Y</span>
                  <span className="gizmo-x">X</span>
                  <i />
                </div>
                <div className="mouse-hints">
                  <span>
                    <MousePointer2 size={13} /> 拖动旋转
                  </span>
                  <span>
                    <Hand size={13} /> 右键平移
                  </span>
                  <span>
                    <Expand size={13} /> 滚轮缩放
                  </span>
                </div>
              </div>
              <div className="scene-tools">
                <button
                  title="向左旋转视角"
                  aria-label="向左旋转视角"
                  onClick={() => api.current?.orbit(-Math.PI / 12)}
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  title="向右旋转视角"
                  aria-label="向右旋转视角"
                  onClick={() => api.current?.orbit(Math.PI / 12)}
                >
                  <RotateCw size={16} />
                </button>
                <span />
                <button
                  title="放大"
                  aria-label="放大"
                  onClick={() => api.current?.zoom(0.85)}
                >
                  <Plus size={17} />
                </button>
                <button
                  title="缩小"
                  aria-label="缩小"
                  onClick={() => api.current?.zoom(1.15)}
                >
                  <Minus size={17} />
                </button>
              </div>
            </div>
            <div className="viewport-footer">
              <div className="display-toggles">
                <button
                  className={grid ? "active" : ""}
                  aria-pressed={grid}
                  onClick={() => setGrid(!grid)}
                >
                  <Grid3X3 size={15} />
                  网格{grid && <Check size={12} />}
                </button>
                <button
                  className={axes ? "active" : ""}
                  aria-pressed={axes}
                  onClick={() => setAxes(!axes)}
                >
                  <Axis3D size={15} />
                  坐标轴{axes && <Check size={12} />}
                </button>
              </div>
              <button
                className="text-button"
                onClick={() => changeView("perspective")}
              >
                <Maximize size={14} /> 重置视角
              </button>
            </div>
          </section>
          <aside className="control-panel" aria-label="机械臂操作与数据">
            <div className="panel-heading">
              <div>
                <Settings2 size={17} />
                <h2>运动控制</h2>
              </div>
              <span className="panel-tag">实时</span>
            </div>
            <div className="control-section">
              <label className="field-title">控制对象</label>
              <div className="mode-switch" role="group" aria-label="控制对象">
                <button
                  aria-pressed={mode === "elbow"}
                  className={mode === "elbow" ? "selected" : ""}
                  onClick={() => changeMode("elbow")}
                >
                  <Crosshair size={15} />
                  大臂肘部
                </button>
                <button
                  aria-pressed={mode === "tool"}
                  className={mode === "tool" ? "selected" : ""}
                  onClick={() => changeMode("tool")}
                >
                  <Move3D size={15} />
                  末端执行器
                </button>
              </div>
              <p className="mode-description">
                {mode === "elbow"
                  ? "控制第一段大臂末端，肘部沿可达弧线运动。"
                  : "控制末端在 X–Z 平面移动，各关节自动联动。"}
              </p>
              <div className="keyboard-heading">
                <span>
                  <Keyboard size={14} />
                  键盘 / 触屏控制
                </span>
                <small>按住持续移动</small>
              </div>
              <div className="dpad-area">
                <span className="direction-label up-label">Z+ 上</span>
                <span className="direction-label left-label">X− 左</span>
                <div className="dpad">
                  {dpad.map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      className={`key key-${key} ${input.pressed.includes(key) ? "pressed" : ""}`}
                      aria-label={label}
                      aria-pressed={input.pressed.includes(key)}
                      disabled={phase !== "ready" || paused}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.currentTarget.focus();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        input.hold(event.pointerId, key);
                      }}
                      onPointerUp={(event) => input.release(event.pointerId)}
                      onPointerCancel={(event) =>
                        input.release(event.pointerId)
                      }
                      onLostPointerCapture={(event) =>
                        input.release(event.pointerId)
                      }
                      onKeyDown={(event) => {
                        if (event.key === " " || event.key === "Enter") {
                          event.preventDefault();
                          input.hold(-key.charCodeAt(0), key);
                        }
                      }}
                      onKeyUp={(event) => {
                        if (event.key === " " || event.key === "Enter")
                          input.release(-key.charCodeAt(0));
                      }}
                      onBlur={() => input.release(-key.charCodeAt(0))}
                    >
                      <Icon size={15} />
                      <b>{key.toUpperCase()}</b>
                    </button>
                  ))}
                  <span className="dpad-center">
                    <Crosshair size={15} />
                  </span>
                </div>
                <span className="direction-label right-label">X+ 右</span>
                <span className="direction-label down-label">Z− 下</span>
              </div>
              <div className="speed-label">
                <label htmlFor="speed">移动速度</label>
                <output htmlFor="speed">
                  {speed.toFixed(2)} <span>m/s</span>
                </output>
              </div>
              <input
                id="speed"
                type="range"
                min="0.05"
                max="0.5"
                step="0.05"
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
                aria-valuetext={`${speed.toFixed(2)} 米每秒`}
              />
              <div className="range-labels">
                <span>精细移动</span>
                <span>快速移动</span>
              </div>
              <div
                className={`control-feedback ${telemetry.boundary ? "boundary" : ""}`}
                role="status"
              >
                {telemetry.boundary ? (
                  <>
                    <Info size={14} />
                    已到达运动范围边界
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} />
                    关节限位保护已启用
                  </>
                )}
              </div>
              <div className="control-actions">
                <button
                  className="primary-button"
                  disabled={phase !== "ready"}
                  onClick={reset}
                >
                  <RotateCcw size={15} />
                  恢复初始姿态
                </button>
                <button
                  className={`pause-button ${paused ? "is-paused" : ""}`}
                  title={paused ? "恢复控制" : "暂停控制"}
                  aria-label={paused ? "恢复控制" : "暂停控制"}
                  aria-pressed={paused}
                  disabled={phase !== "ready"}
                  onClick={() => {
                    input.clear();
                    setPaused(!paused);
                  }}
                >
                  {paused ? <Play size={17} /> : <Pause size={17} />}
                </button>
              </div>
            </div>
            <div className="telemetry-section">
              <div className="section-title">
                <h3>空间位置</h3>
                <span>{mode === "elbow" ? "肘部" : "末端"} · 世界坐标</span>
              </div>
              <div className="coordinates">
                {["X", "Y", "Z"].map((axis, i) => (
                  <div key={axis}>
                    <span
                      className={`coordinate-label axis-${axis.toLowerCase()}`}
                    >
                      {axis}
                    </span>
                    <strong data-testid={`position-${axis.toLowerCase()}`}>
                      {phase === "ready"
                        ? telemetry.position[i].toFixed(3)
                        : "—"}
                    </strong>
                    <small>m</small>
                  </div>
                ))}
              </div>
              <div className="section-title joint-title">
                <h3>关节角度</h3>
                <span>° DEG</span>
              </div>
              <div className="joint-list">
                {telemetry.angles.map((angle, i) => (
                  <div className="joint-row" key={i}>
                    <span className="joint-id">J{i + 1}</span>
                    <span className="joint-name">{jointNames[i]}</span>
                    <div className="joint-track">
                      <i
                        style={{
                          width: `${((angle - jointRanges[i][0]) / (jointRanges[i][1] - jointRanges[i][0])) * 100}%`,
                        }}
                      />
                    </div>
                    <output data-testid={`joint-${i + 1}`}>
                      {angle.toFixed(1)}
                      <small>°</small>
                    </output>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
        <div className="workspace-note">
          <span>
            <Info size={14} />
            <b>小黄黄的实验提示</b>{" "}
            <span>先试着按住 W，再用鼠标转个角度观察。</span>
          </span>
          <button onClick={() => openDialog(help.current)}>
            了解操作方式
            <ArrowUpRight size={14} />
          </button>
        </div>
      </main>
      <footer className="app-footer">
        <span>
          <i />
          浏览器内实时仿真<span className="footer-divider">/</span>底座固定 · Z
          轴向上
        </span>
        <button onClick={() => openDialog(source.current)}>
          模型来源与许可
          <ArrowUpRight size={13} />
        </button>
      </footer>
      <dialog ref={help} className="info-dialog" onClose={input.clear}>
        <div className="dialog-heading">
          <h2>开始你的第一次探索</h2>
          <button
            aria-label="关闭使用指南"
            onClick={() => help.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p>小黄黄，用键盘或屏幕方向键，观察真实机械臂的关节联动。</p>
        <dl>
          <dt>W / S · 上下</dt>
          <dd>沿世界 Z 轴方向移动控制点。</dd>
          <dt>A / D · 左右</dt>
          <dd>沿世界 X 轴方向移动控制点，与相机视角无关。</dd>
          <dt>大臂肘部</dt>
          <dd>
            控制第一段大臂末端（J3
            关节原点）。由于大臂长度固定，移动会投影到可达弧线，X、Z
            坐标会联动变化。
          </dd>
          <dt>末端执行器</dt>
          <dd>
            使用位置逆运动学控制法兰位置，Y
            保持不变，末端朝向自由。支持斜向移动，斜向指令速度与单方向一致。
          </dd>
          <dt>观察视角</dt>
          <dd>
            左键拖动旋转，右键拖动平移，滚轮缩放。也可使用视角切换和场景中的旋转、缩放按钮。
          </dd>
        </dl>
        <div className="dialog-note">
          松开按键、切换窗口、进入输入控件或打开此指南时，运动立即停止。本演示不包含碰撞检测，不连接真实机器人。
        </div>
        <button
          className="primary-button"
          onClick={() => help.current?.close()}
        >
          开始探索
          <ArrowRight size={15} />
        </button>
      </dialog>
      <dialog ref={source} className="info-dialog">
        <div className="dialog-heading">
          <h2>模型来源与许可</h2>
          <button
            aria-label="关闭模型说明"
            onClick={() => source.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p>
          本项目使用 ROS-Industrial 的 FANUC R-1000iA/80F
          模型，而非近似形状的替代模型。
        </p>
        <dl>
          <dt>模型作者</dt>
          <dd>TU Delft Robotics Institute / ROS-Industrial contributors</dd>
          <dt>许可证</dt>
          <dd>BSD 3-Clause。原始版权声明、条件及免责声明随模型一并保留。</dd>
          <dt>本地处理</dt>
          <dd>
            将 Xacro 展开为浏览器可读取的
            URDF，保留几何、坐标系、关节轴和限位；网格文件未修改。
          </dd>
          <dt>模型版本</dt>
          <dd className="commit-hash">
            d8f42bd73584b255df87098395512538882caea1
          </dd>
        </dl>
        <div className="source-links">
          <a
            href="https://github.com/ros-industrial/fanuc/tree/d8f42bd73584b255df87098395512538882caea1/fanuc_r1000ia_support"
            target="_blank"
            rel="noreferrer"
          >
            查看模型仓库
            <ArrowUpRight size={14} />
          </a>
          <a
            href="models/fanuc-r1000ia80f/LICENSE.txt"
            target="_blank"
            rel="noreferrer"
          >
            完整许可证
            <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="dialog-note">
          这是学习与可视化演示，未验证实体机械臂的控制安全性。FANUC
          商标归其权利人所有，本项目不代表官方产品。
        </div>
      </dialog>
    </div>
  );
}
