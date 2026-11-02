/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';

const ChannelModalContent = React.lazy(() => import('./channels/ChannelModalContent'));

/** Configure server-side messaging channels without desktop service controls. */
const ChannelsModalContent: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<div className='text-13px text-t-secondary'>{t('common.loading')}</div>}>
      <ChannelModalContent />
    </Suspense>
  );
};

export default ChannelsModalContent;
