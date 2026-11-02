/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Qianji 基础组件库统一导出 / Qianji base components unified exports
 *
 * 提供所有基础组件和类型的统一导出入口
 * Provides unified export entry for all base components and types
 */

// ==================== 组件导出 / Component Exports ====================

export { default as QianjiModal } from './QianjiModal';
export { default as QianjiCollapse } from './QianjiCollapse';
export { default as QianjiSelect } from './QianjiSelect';
export { default as QianjiScrollArea } from './QianjiScrollArea';
export { default as QianjiSteps } from './QianjiSteps';
export { default as QianjiSearchInput } from './QianjiSearchInput';
export { default as QianjiInlineSearchInput } from './QianjiInlineSearchInput';

// ==================== 类型导出 / Type Exports ====================

// QianjiModal 类型 / QianjiModal types
export type {
  ModalSize,
  ModalHeaderConfig,
  ModalFooterConfig,
  ModalContentStyleConfig,
  QianjiModalProps,
} from './QianjiModal';
export { MODAL_SIZES } from './QianjiModal';

// QianjiCollapse 类型 / QianjiCollapse types
export type { QianjiCollapseProps, QianjiCollapseItemProps } from './QianjiCollapse';

// QianjiSelect 类型 / QianjiSelect types
export type { QianjiSelectProps } from './QianjiSelect';

// QianjiSteps 类型 / QianjiSteps types
export type { QianjiStepsProps } from './QianjiSteps';

// QianjiSearchInput 类型 / QianjiSearchInput types
export type { QianjiSearchInputProps } from './QianjiSearchInput';

// QianjiInlineSearchInput 类型 / QianjiInlineSearchInput types
export type { QianjiInlineSearchInputProps } from './QianjiInlineSearchInput';
