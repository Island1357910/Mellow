import { Component } from 'react';

/** 捕获子树渲染错误，避免整页白屏（使用现有 panel/btn 样式，不改变视觉主题） */
export default class GameErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[千味面包房] 界面错误', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="panel page-view-body">
          <p className="drawer-hint">游戏界面出现问题，可尝试刷新页面。</p>
          <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
            刷新
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
