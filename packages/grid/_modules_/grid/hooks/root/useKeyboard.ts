import * as React from 'react';
import { CELL_CSS_CLASS, ROW_CSS_CLASS } from '../../constants/cssClassesConstants';
import {
  GRID_FOCUS_OUT,
  KEYDOWN,
  KEYUP,
  MULTIPLE_KEY_PRESS_CHANGED,
  SCROLLING,
} from '../../constants/eventsConstants';
import { ApiRef } from '../../models/api/apiRef';
import { CellIndexCoordinates } from '../../models/rows';
import {
  findGridRootFromCurrent,
  findParentElementFromClassName,
  getCellElementFromIndexes,
  getIdFromRowElem,
  isCell,
} from '../../utils/domUtils';
import {
  isArrowKeys,
  isHomeOrEndKeys,
  isMultipleKey,
  isNavigationKey,
  isPageKeys,
  isSpaceKey,
  isTabKey,
} from '../../utils/keyboardUtils';
import { useGridSelector } from '../features/core/useGridSelector';
import { rowCountSelector } from '../features/rows/rowsSelector';
import { useLogger } from '../utils/useLogger';
import { optionsSelector } from '../utils/useOptionsProp';
import { useApiEventHandler } from './useApiEventHandler';

const getNextCellIndexes = (code: string, indexes: CellIndexCoordinates) => {
  if (!isArrowKeys(code)) {
    throw new Error('Material-UI: The first argument (code) should be an arrow key code.');
  }

  if (code === 'ArrowLeft') {
    return { ...indexes, colIndex: indexes.colIndex - 1 };
  }
  if (code === 'ArrowRight') {
    return { ...indexes, colIndex: indexes.colIndex + 1 };
  }
  if (code === 'ArrowUp') {
    return { ...indexes, rowIndex: indexes.rowIndex - 1 };
  }
  // Last option code === 'ArrowDown'
  return { ...indexes, rowIndex: indexes.rowIndex + 1 };
};

export const useKeyboard = (apiRef: ApiRef): void => {
  const logger = useLogger('useKeyboard');
  const rafFocusOnCellRef = React.useRef(0);
  const options = useGridSelector(apiRef, optionsSelector);
  const totalRowCount = useGridSelector(apiRef, rowCountSelector);

  const onMultipleKeyChange = React.useCallback(
    (isPressed: boolean) => {
      apiRef.current.publishEvent(MULTIPLE_KEY_PRESS_CHANGED, isPressed);
    },
    [apiRef],
  );

  const navigateCells = React.useCallback(
    (code: string, isCtrlPressed: boolean) => {
      const cellEl = findParentElementFromClassName(
        document.activeElement as HTMLDivElement,
        CELL_CSS_CLASS,
      )! as HTMLElement;
      cellEl.tabIndex = -1;

      const root = findGridRootFromCurrent(cellEl)!;
      const currentColIndex = Number(cellEl.getAttribute('aria-colindex'));
      const currentRowIndex = Number(cellEl.getAttribute('data-rowindex'));
      const autoPageSize = apiRef.current.getContainerPropsState()!.viewportPageSize;
      const pageSize =
        options.pagination && options.pageSize != null ? options.pageSize : autoPageSize;
      const rowCount = options.pagination ? pageSize : totalRowCount;
      const colCount = apiRef.current.getVisibleColumns().length;

      let nextCellIndexes: CellIndexCoordinates;
      if (isArrowKeys(code)) {
        nextCellIndexes = getNextCellIndexes(code, {
          colIndex: currentColIndex,
          rowIndex: currentRowIndex,
        });
      } else if (isHomeOrEndKeys(code)) {
        const colIdx = code === 'Home' ? 0 : colCount - 1;

        if (!isCtrlPressed) {
          // we go to the current row, first col, or last col!
          nextCellIndexes = { colIndex: colIdx, rowIndex: currentRowIndex };
        } else {
          // In that case we go to first row, first col, or last row last col!
          const rowIndex = colIdx === 0 ? 0 : rowCount - 1;
          nextCellIndexes = { colIndex: colIdx, rowIndex };
        }
      } else if (isPageKeys(code) || isSpaceKey(code)) {
        const nextRowIndex =
          currentRowIndex +
          (code.indexOf('Down') > -1 || isSpaceKey(code) ? autoPageSize : -1 * autoPageSize);
        nextCellIndexes = { colIndex: currentColIndex, rowIndex: nextRowIndex };
      } else {
        throw new Error('Material-UI. Key not mapped to navigation behavior.');
      }

      nextCellIndexes.rowIndex = nextCellIndexes.rowIndex <= 0 ? 0 : nextCellIndexes.rowIndex;
      nextCellIndexes.rowIndex =
        nextCellIndexes.rowIndex >= rowCount && rowCount > 0
          ? rowCount - 1
          : nextCellIndexes.rowIndex;
      nextCellIndexes.colIndex = nextCellIndexes.colIndex <= 0 ? 0 : nextCellIndexes.colIndex;
      nextCellIndexes.colIndex =
        nextCellIndexes.colIndex >= colCount ? colCount - 1 : nextCellIndexes.colIndex;

      if (rafFocusOnCellRef.current) {
        clearTimeout(rafFocusOnCellRef.current);
      }

      apiRef.current.once(SCROLLING, () => {
        rafFocusOnCellRef.current = window.setTimeout(() => {
          const nextCell = getCellElementFromIndexes(root, nextCellIndexes);

          if (nextCell) {
            logger.debug(
              `Focusing on cell with index ${nextCellIndexes.rowIndex} - ${nextCellIndexes.colIndex} `,
            );
            nextCell.tabIndex = 0;
            (nextCell as HTMLDivElement).focus();
          }
        }, 0);
      });

      apiRef.current.scrollToIndexes(nextCellIndexes);

      return nextCellIndexes;
    },
    [apiRef, options.pagination, options.pageSize, totalRowCount, logger],
  );

  const selectActiveRow = React.useCallback(() => {
    const rowEl = findParentElementFromClassName(
      document.activeElement as HTMLDivElement,
      ROW_CSS_CLASS,
    )! as HTMLElement;

    const rowId = getIdFromRowElem(rowEl);
    apiRef.current.selectRow(rowId);
  }, [apiRef]);

  const expandSelection = React.useCallback(
    (code: string) => {
      const rowEl = findParentElementFromClassName(
        document.activeElement as HTMLDivElement,
        ROW_CSS_CLASS,
      )! as HTMLElement;

      const currentRowIndex = Number(rowEl.getAttribute('data-rowindex'));
      let selectionFromRowIndex = currentRowIndex;
      const selectedRows = apiRef.current.getSelectedRows();
      if (selectedRows.length > 0) {
        const selectedRowsIndex = selectedRows.map((row) =>
          apiRef.current.getRowIndexFromId(row.id),
        );

        const diffWithCurrentIndex: number[] = selectedRowsIndex.map((idx) =>
          Math.abs(currentRowIndex - idx),
        );
        const minIndex = Math.max(...diffWithCurrentIndex);
        selectionFromRowIndex = selectedRowsIndex[diffWithCurrentIndex.indexOf(minIndex)];
      }

      const nextCellIndexes = navigateCells(code, false);
      // We select the rows in between
      const rowIds = Array(Math.abs(nextCellIndexes.rowIndex - selectionFromRowIndex) + 1)
        .fill(
          nextCellIndexes.rowIndex > selectionFromRowIndex
            ? selectionFromRowIndex
            : nextCellIndexes.rowIndex,
        )
        .map((cur, idx) => apiRef.current.getRowIdFromRowIndex(cur + idx));

      logger.debug('Selecting rows ', rowIds);

      apiRef.current.selectRows(rowIds, true, true);
    },
    [logger, apiRef, navigateCells],
  );

  const handleCopy = React.useCallback(() => {
    const rowEl = findParentElementFromClassName(
      document.activeElement as HTMLDivElement,
      ROW_CSS_CLASS,
    )! as HTMLElement;
    const rowId = getIdFromRowElem(rowEl);
    const rowModel = apiRef.current.getRowFromId(rowId);

    if (rowModel.selected) {
      window?.getSelection()?.selectAllChildren(rowEl);
    } else {
      window?.getSelection()?.selectAllChildren(document.activeElement!);
    }
    document.execCommand('copy');
  }, [apiRef]);

  const onKeyDownHandler = React.useCallback(
    (event: KeyboardEvent) => {
      if (isMultipleKey(event.key)) {
        logger.debug('Multiple Select key pressed');
        onMultipleKeyChange(true);
        return;
      }

      if (!isCell(document.activeElement)) {
        return;
      }

      if (!isTabKey(event.code)) {
        // WE prevent default behavior for all key shortcut except tab when the current active element is a cell
        event.preventDefault();
        event.stopPropagation();
      }

      if (isSpaceKey(event.code) && event.shiftKey) {
        selectActiveRow();
        return;
      }

      if (isNavigationKey(event.code) && !event.shiftKey) {
        navigateCells(event.code, event.ctrlKey || event.metaKey);
        return;
      }
      if (isNavigationKey(event.code) && event.shiftKey) {
        expandSelection(event.code);
        return;
      }

      if (event.key.toLowerCase() === 'c' && (event.ctrlKey || event.metaKey)) {
        handleCopy();
        return;
      }

      if (event.key.toLowerCase() === 'a' && (event.ctrlKey || event.metaKey)) {
        apiRef.current.selectRows(apiRef.current.getAllRowIds(), true);
      }
    },
    [
      apiRef,
      logger,
      onMultipleKeyChange,
      expandSelection,
      handleCopy,
      navigateCells,
      selectActiveRow,
    ],
  );

  const onKeyUpHandler = React.useCallback(
    (event: KeyboardEvent) => {
      if (isMultipleKey(event.key)) {
        logger.debug('Multiple Select key released');
        onMultipleKeyChange(false);
      }
    },
    [logger, onMultipleKeyChange],
  );

  const onFocusOutHandler = React.useCallback(
    () => {
      logger.debug('Grid lost focus, releasing key press');
      onMultipleKeyChange(false);
    },
    [logger, onMultipleKeyChange],
  );

  useApiEventHandler(apiRef, KEYDOWN, onKeyDownHandler);
  useApiEventHandler(apiRef, KEYUP, onKeyUpHandler);
  useApiEventHandler(apiRef, GRID_FOCUS_OUT, onFocusOutHandler);
};
