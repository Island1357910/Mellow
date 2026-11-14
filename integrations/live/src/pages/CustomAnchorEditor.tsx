import { useMemo, useRef, useState, type HTMLAttributes } from 'react';
import StatusBar from '../components/Phone/StatusBar';
import ScreenHeader from '../components/Common/ScreenHeader';
import {
  createEmptyCustomDraft,
  profileToDraft,
  useCustomAnchorStore,
  type CustomAnchorDraft,
} from '../stores/useCustomAnchorStore';
import { useAnchorStore } from '../stores/useAnchorStore';
import { useNavStore } from '../stores/useNavStore';
import { useToastStore } from '../stores/useToastStore';
import { MAX_IMAGE_IMPORT_BYTES, formatFileSize, readFileAsDataUrl } from '../utils/fileImport';
import type { SpeciesCategory } from '../types';

const SPECIES_OPTIONS: SpeciesCategory[] = ['神明', '恶魔', '天使', '魅魔'];

const GRADIENT_PREVIEW = [
  'from-orange-400 to-pink-500',
  'from-cyan-500 to-blue-700',
  'from-indigo-400 to-purple-600',
  'from-rose-400 to-red-600',
];

function linesToText(lines: string[]) {
  return lines.join('\n');
}

/** 编辑时保留换行与空行，保存时再 trim / 过滤 */
function textToLines(text: string) {
  return text.split('\n');
}

export default function CustomAnchorEditor({ anchorId }: { anchorId?: string }) {
  const back = useNavStore((s) => s.back);
  const existing = useCustomAnchorStore((s) =>
    anchorId ? s.anchors.find((a) => a.id === anchorId) : undefined
  );
  const createAnchor = useCustomAnchorStore((s) => s.createAnchor);
  const updateAnchor = useCustomAnchorStore((s) => s.updateAnchor);
  const removeAnchor = useCustomAnchorStore((s) => s.removeAnchor);
  const fileRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<CustomAnchorDraft>(() =>
    existing ? profileToDraft(existing) : createEmptyCustomDraft()
  );
  const [section, setSection] = useState<'basic' | 'persona' | 'presets'>('basic');

  const previewGradient = useMemo(
    () => GRADIENT_PREVIEW[draft.stageName.length % GRADIENT_PREVIEW.length],
    [draft.stageName]
  );

  const patch = <K extends keyof CustomAnchorDraft>(key: K, value: CustomAnchorDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const patchPresets = <K extends keyof CustomAnchorDraft['presets']>(
    key: K,
    value: CustomAnchorDraft['presets'][K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      presets: { ...prev.presets, [key]: value },
    }));
  };

  const onPickPortrait = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      useToastStore.getState().show('请选择图片文件');
      return;
    }
    if (file.size > MAX_IMAGE_IMPORT_BYTES) {
      useToastStore.getState().show(`图片过大，上限 ${formatFileSize(MAX_IMAGE_IMPORT_BYTES)}`);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      patch('portraitUrl', dataUrl);
    } catch {
      useToastStore.getState().show('读取图片失败');
    }
  };

  const save = () => {
    if (!draft.stageName.trim()) {
      useToastStore.getState().show('请填写艺名');
      setSection('basic');
      return;
    }
    if (!draft.personality.trim() || !draft.speakingStyle.trim()) {
      useToastStore.getState().show('请至少填写性格与说话风格');
      setSection('persona');
      return;
    }

    let id = anchorId;
    if (existing && id) {
      updateAnchor(id, draft);
      useToastStore.getState().show('已保存自定义主播');
    } else {
      id = createAnchor(draft);
      useToastStore.getState().show('已创建自定义主播');
    }
    useAnchorStore.getState().ensureInit();
    useAnchorStore.getState().follow(id);
    // 立即刷新在线态
    useAnchorStore.getState().tickSimulation();
    back();
  };

  const handleDelete = () => {
    if (!anchorId || !existing) return;
    if (!window.confirm(`确定删除「${existing.stageName}」？相关好感与聊天不会自动清理。`)) return;
    removeAnchor(anchorId);
    useToastStore.getState().show('已删除自定义主播');
    back();
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <StatusBar />
      <ScreenHeader
        title={existing ? '编辑主播' : '创建主播'}
        onBack={back}
        right={
          <button
            type="button"
            onClick={save}
            className="rounded-full bg-[#0f1419] px-3 py-1 text-[13px] font-bold text-white active:scale-95"
          >
            保存
          </button>
        }
      />

      <div className="flex shrink-0 border-b border-[#eff3f4]">
        {(
          [
            ['basic', '基础'],
            ['persona', '人设'],
            ['presets', '预设'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            className={`flex-1 py-3 text-[14px] font-bold transition ${
              section === key
                ? 'border-b-2 border-[#1d9bf0] text-[#0f1419]'
                : 'text-[#536471]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-10">
        {section === 'basic' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-[#cfd9de] bg-[#eff3f4]"
              >
                {draft.portraitUrl ? (
                  <img src={draft.portraitUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div
                    className={`flex h-full w-full items-center justify-center bg-gradient-to-br text-2xl font-bold text-white ${previewGradient}`}
                  >
                    {(draft.stageName || '?').charAt(0)}
                  </div>
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-[#0f1419]">立绘 / 头像</p>
                <p className="mt-1 text-[13px] text-[#536471]">点击上传本地图片，将作为直播间与头像展示</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="rounded-full bg-[#1d9bf0] px-3 py-1 text-[12px] font-bold text-white"
                  >
                    上传图片
                  </button>
                  {draft.portraitUrl && (
                    <button
                      type="button"
                      onClick={() => patch('portraitUrl', '')}
                      className="rounded-full border border-[#cfd9de] px-3 py-1 text-[12px] font-bold text-[#0f1419]"
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickPortrait(e.target.files?.[0] ?? null)}
              />
            </div>

            <Field label="艺名 *" value={draft.stageName} onChange={(v) => patch('stageName', v)} placeholder="直播显示名" />
            <Field label="真名 / Handle" value={draft.realName} onChange={(v) => patch('realName', v)} placeholder="用于 @handle" />
            <Field label="标签" value={draft.tag} onChange={(v) => patch('tag', v)} placeholder="如：温柔系 / 高冷系" />
            <Field
              label="年龄"
              value={String(draft.age)}
              onChange={(v) => patch('age', Number(v.replace(/\D/g, '')) || 22)}
              placeholder="22"
              inputMode="numeric"
            />
            <Field
              label="年龄描述（可选）"
              value={draft.ageLabel ?? ''}
              onChange={(v) => patch('ageLabel', v)}
              placeholder="外表26岁/实际不详"
            />
            <Field label="发色" value={draft.hairColor} onChange={(v) => patch('hairColor', v)} placeholder="如：银白长发" />
            <Area
              label="外貌描述"
              value={draft.appearance}
              onChange={(v) => patch('appearance', v)}
              placeholder="五官、服饰、气质等，供 AI 保持形象一致"
            />

            <div>
              <p className="mb-2 text-[13px] font-bold text-[#0f1419]">物种</p>
              <div className="flex flex-wrap gap-2">
                <Chip active={draft.isHuman} onClick={() => patch('isHuman', true)} label="人类" />
                <Chip
                  active={!draft.isHuman}
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      isHuman: false,
                      speciesCategory: prev.speciesCategory ?? '魅魔',
                      species: prev.species || '自定义非人类',
                    }))
                  }
                  label="非人类"
                />
              </div>
              {!draft.isHuman && (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {SPECIES_OPTIONS.map((s) => (
                      <Chip
                        key={s}
                        active={draft.speciesCategory === s}
                        onClick={() => patch('speciesCategory', s)}
                        label={s}
                      />
                    ))}
                  </div>
                  <Field
                    label="具体物种"
                    value={draft.species ?? ''}
                    onChange={(v) => patch('species', v)}
                    placeholder="如：契约恶魔、堕天使"
                  />
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-[13px] font-bold text-[#0f1419]">开播设置</p>
              <label className="flex items-center gap-2 text-[14px] text-[#0f1419]">
                <input
                  type="checkbox"
                  checked={draft.presets.alwaysLive !== false}
                  onChange={(e) => patchPresets('alwaysLive', e.target.checked)}
                  className="h-4 w-4 accent-[#1d9bf0]"
                />
                始终视为直播中（推荐）
              </label>
              {draft.presets.alwaysLive === false && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field
                    label="开播小时"
                    value={String(draft.presets.liveStartHour ?? 19)}
                    onChange={(v) =>
                      patchPresets('liveStartHour', Math.min(23, Math.max(0, Number(v) || 0)))
                    }
                    inputMode="numeric"
                  />
                  <Field
                    label="下播小时"
                    value={String(draft.presets.liveEndHour ?? 23)}
                    onChange={(v) =>
                      patchPresets('liveEndHour', Math.min(24, Math.max(1, Number(v) || 23)))
                    }
                    inputMode="numeric"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {section === 'persona' && (
          <div className="flex flex-col gap-4">
            <Area
              label="性格 *"
              value={draft.personality}
              onChange={(v) => patch('personality', v)}
              placeholder="例如：表面高冷实则黏人，吃醋时会阴阳怪气"
              rows={3}
            />
            <Area
              label="直播间说话风格 *"
              value={draft.speakingStyle}
              onChange={(v) => patch('speakingStyle', v)}
              placeholder="口癖、句式、语气，如：爱用叠词、少字高冷、东北口音"
              rows={3}
            />
            <Area
              label="绿茶属性"
              value={draft.greenTeaStyle}
              onChange={(v) => patch('greenTeaStyle', v)}
              placeholder="如何暗示自己比其他主播更好"
              rows={2}
            />
            <Area
              label="求打赏方式"
              value={draft.tipStyle}
              onChange={(v) => patch('tipStyle', v)}
              placeholder="直播间如何点名礼物、撒娇求赏"
              rows={2}
            />
            <Area
              label="私信聊天方式"
              value={draft.chatStyle}
              onChange={(v) => patch('chatStyle', v)}
              placeholder="私信与直播间的语气差异"
              rows={2}
            />
            <Area
              label="人设背景"
              value={draft.background}
              onChange={(v) => patch('background', v)}
              placeholder="出身、经历、与观众的关系设定"
              rows={3}
            />
          </div>
        )}

        {section === 'presets' && (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] leading-5 text-[#536471]">
              每行一条。AI 会优先参考这些预设内容来说话。
            </p>
            <Area
              label="进房欢迎语"
              value={linesToText(draft.presets.welcomeLines)}
              onChange={(v) => patchPresets('welcomeLines', textToLines(v))}
              placeholder={'姐姐来了……今天也想你了\n哇，榜一大人驾到'}
              rows={4}
            />
            <Area
              label="口头禅 / 常用口播"
              value={linesToText(draft.presets.catchphrases)}
              onChange={(v) => patchPresets('catchphrases', textToLines(v))}
              placeholder={'你再不理我我就……算了还是求你理我吧\n今天状态一般，但看到你就好了'}
              rows={4}
            />
            <Area
              label="求赏话术"
              value={linesToText(draft.presets.tipLines)}
              onChange={(v) => patchPresets('tipLines', textToLines(v))}
              placeholder={'姐姐送个小心心嘛，只要1币\n冲榜的话……我会更听话哦'}
              rows={4}
            />
            <Area
              label="直播活动偏好"
              value={linesToText(draft.presets.activityLabels)}
              onChange={(v) => patchPresets('activityLabels', textToLines(v))}
              placeholder={'正在听歌放空\n在回粉丝私信\n正在打游戏'}
              rows={4}
            />
          </div>
        )}

        {existing && (
          <button
            type="button"
            onClick={handleDelete}
            className="mt-8 w-full rounded-full border border-[#f4212e] py-2.5 text-[14px] font-bold text-[#f4212e]"
          >
            删除此主播
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-bold text-[#0f1419]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full rounded-xl border border-[#cfd9de] bg-[#eff3f4] px-3 py-2.5 text-[15px] text-[#0f1419] outline-none placeholder:text-[#536471] focus:border-[#1d9bf0] focus:bg-white"
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-bold text-[#0f1419]">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // 允许 Enter 换行，避免被外层快捷键吞掉
          if (e.key === 'Enter') e.stopPropagation();
        }}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-y rounded-xl border border-[#cfd9de] bg-[#eff3f4] px-3 py-2.5 text-[15px] leading-5 text-[#0f1419] outline-none placeholder:text-[#536471] focus:border-[#1d9bf0] focus:bg-white"
      />
    </label>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[13px] font-bold transition ${
        active
          ? 'bg-[#0f1419] text-white'
          : 'border border-[#cfd9de] text-[#0f1419] hover:bg-black/[0.03]'
      }`}
    >
      {label}
    </button>
  );
}
