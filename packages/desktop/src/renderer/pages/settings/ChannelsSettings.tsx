/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ChannelsModalContent from '@/renderer/components/settings/SettingsModal/contents/ChannelsModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const ChannelsSettings: React.FC = () => {
  return (
    <SettingsPageWrapper>
      <ChannelsModalContent />
    </SettingsPageWrapper>
  );
};

export default ChannelsSettings;
