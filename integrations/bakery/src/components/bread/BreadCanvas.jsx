import { useState, useRef, useEffect, memo } from 'react';
import { drawBread } from '../../systems/visualEngine';
import { getBreadImageUrl, getBreadImageFilter } from '../../data/breadImages';

/** 固定 1:1 比例，避免面包图片被拉伸变形。优先使用预设面包图片（带特效滤镜），否则绘制矢量图形 */
function BreadCanvas({ recipe, width = 120, height = 120, size }) {
  const canvasRef = useRef(null);
  const [imgError, setImgError] = useState(false);
  const sz = Math.min(width, height);
  const imageUrl = recipe ? getBreadImageUrl(recipe) : null;
  const useImage = imageUrl && !imgError;

  useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

  useEffect(() => {
    if (!useImage && canvasRef.current && recipe) {
      drawBread(canvasRef.current, recipe, size);
    }
  }, [useImage, recipe, size]);

  if (useImage) {
    const filter = getBreadImageFilter(recipe);
    return (
      <div className="bread-canvas-wrapper" style={{ width: sz, height: sz }}>
        <img
          src={imageUrl}
          alt=""
          className="bread-canvas bread-image"
          style={{
            width: sz,
            height: sz,
            borderRadius: 4,
            objectFit: 'contain',
            background: 'var(--bg-dark)',
            filter,
          }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <canvas ref={canvasRef} width={sz} height={sz} className="bread-canvas" style={{ borderRadius: 4, background: 'var(--bg-dark)' }} />
  );
}

export default memo(BreadCanvas);
