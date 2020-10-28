import * as React from 'react';
import { debounce } from '@material-ui/core/utils';
import { useLogger } from './useLogger';

export interface ScrollParams {
  left: number;
  top: number;
}
export type ScrollFn = (v: ScrollParams) => void;

export function useScrollFn(
  renderingZoneElementRef: React.RefObject<HTMLDivElement>,
  columnHeadersElementRef: React.RefObject<HTMLDivElement>,
): [ScrollFn, ScrollFn] {
  const logger = useLogger('useScrollFn');
  const previousValue = React.useRef<ScrollParams>();

  const debouncedResetPointerEvents = React.useMemo(
    () =>
      debounce(() => {
        renderingZoneElementRef.current!.style.pointerEvents = 'unset';
      }, 300),
    [renderingZoneElementRef],
  );

  const scrollTo: (v: ScrollParams) => void = React.useCallback(
    (v) => {
      if (v.left === previousValue.current?.left && v.top === previousValue.current.top) {
        return;
      }

      if (renderingZoneElementRef && renderingZoneElementRef.current) {
        logger.debug(`Moving ${renderingZoneElementRef.current.className} to: ${v.left}-${v.top}`);
        if (renderingZoneElementRef.current!.style.pointerEvents !== 'none') {
          renderingZoneElementRef.current!.style.pointerEvents = 'none';
        }
        renderingZoneElementRef.current!.style.transform = `translate(-${v.left}px, -${v.top}px)`;
        columnHeadersElementRef.current!.style.transform = `translate(-${v.left}px, -0px)`;
        debouncedResetPointerEvents();
        previousValue.current = v;
      }
    },
    [renderingZoneElementRef, logger, columnHeadersElementRef, debouncedResetPointerEvents],
  );

  React.useEffect(() => {
    return () => {
      debouncedResetPointerEvents.clear();
    };
  }, [renderingZoneElementRef, debouncedResetPointerEvents]);

  return [scrollTo, scrollTo];
}
