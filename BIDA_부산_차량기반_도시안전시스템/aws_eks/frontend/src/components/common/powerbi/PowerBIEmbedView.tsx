import { useEffect, useRef } from 'react';
import * as pbi from 'powerbi-client';
import type { PowerBIConfig } from '../../../types/dashboard';

interface PowerBIEmbedViewProps {
  config?: PowerBIConfig | null;
  reportUrl?: string; // URL 직접 사용 옵션 추가
  height?: string;
}

export default function PowerBIEmbedView({ 
  config, 
  reportUrl,
  height = '800px' 
}: PowerBIEmbedViewProps) {
  const embedContainerRef = useRef<HTMLDivElement>(null);

  // URL이 제공되면 iframe으로 직접 표시 (백엔드 불필요)
  if (reportUrl) {
    return (
      <div className="w-full" style={{ minHeight: height }}>
        <iframe
          src={reportUrl}
          width="100%"
          height={height}
          frameBorder="0"
          allowFullScreen
          style={{
            border: 'none',
            borderRadius: '8px',
            display: 'block',
            width: '100%',
            minHeight: height,
          }}
          title="Power BI Report"
        />
      </div>
    );
  }

  // 기존 방식: config를 사용한 공식 임베드 (백엔드 필요)
  useEffect(() => {
    if (!embedContainerRef.current || !config) return;

    const powerbi = new pbi.service.Service(
      pbi.factories.hpmFactory,
      pbi.factories.wpmpFactory,
      pbi.factories.routerFactory
    );

    const embedConfig: pbi.models.IEmbedConfiguration = {
      type: 'report',
      tokenType: pbi.models.TokenType.Embed,
      accessToken: config.accessToken,
      embedUrl: config.embedUrl,
      id: config.embedId,
      settings: {
        panes: {
          filters: { expanded: false, visible: false },
          pageNavigation: { visible: true },
        },
      },
    };

    const report = powerbi.embed(embedContainerRef.current, embedConfig);

    return () => {
      try {
        report.off('loaded');
      } catch (error) {
        console.error('PowerBI cleanup error:', error);
      }
    };
  }, [config]);

  if (!config) {
    return <div>PowerBI 설정을 불러오는 중...</div>;
  }

  return (
    <div
      ref={embedContainerRef}
      style={{
        width: '100%',
        height,
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
      }}
    />
  );
}



