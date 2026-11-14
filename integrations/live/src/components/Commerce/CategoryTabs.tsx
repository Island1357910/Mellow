import ScrollTabs from '../Common/ScrollTabs';

interface CategoryTabsProps {
  categories: string[];
  active: string;
  onChange: (c: string) => void;
  /** 保留参数以兼容旧调用；X 风格默认用 pill */
  activeClassName?: string;
  inactiveClassName?: string;
}

/** 可左右滑动的分类 Tab（移动端触摸 + 电脑端拖拽/滚轮） */
export default function CategoryTabs({ categories, active, onChange }: CategoryTabsProps) {
  return <ScrollTabs items={categories} active={active} onChange={onChange} variant="pill" />;
}
