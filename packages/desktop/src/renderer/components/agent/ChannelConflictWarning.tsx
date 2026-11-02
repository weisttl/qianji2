/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Alert, Button, Link, Space, Typography } from '@arco-design/web-react';
import { Attention } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Paragraph, Text } = Typography;
type ChannelConflictWarningProps = {
  platform: 'lark' | 'telegram';
  openclawConfigPath: string;
  onDisableOpenClaw?: () => void;
  onIgnore?: () => void;
};

/** Explains how to resolve competing bot connections without changing them automatically. */
export const ChannelConflictWarning: React.FC<ChannelConflictWarningProps> = ({
  platform,
  openclawConfigPath,
  onDisableOpenClaw,
  onIgnore,
}) => {
  const { t } = useTranslation();
  const platformName = platform === 'lark' ? 'Lark/Feishu' : 'Telegram';
  const params = { platform: platformName };
  const channelKey = platform === 'lark' ? 'feishu' : 'telegram';
  return (
    <Alert
      type='warning'
      icon={<Attention size={18} />}
      title={t('acp.channelConflict.title', params)}
      className='mb-16px'
      content={
        <Space direction='vertical' size='medium' className='w-full'>
          <Paragraph>
            <Text bold>{t('acp.channelConflict.active', params)}</Text>
          </Paragraph>
          <Paragraph>
            {t('acp.channelConflict.description', params)}
            <ul>
              <li>
                <Text type='error'>{t('acp.channelConflict.switchUnavailable')}</Text>
              </li>
              <li>
                <Text type='error'>{t('acp.channelConflict.processedByOpenClaw')}</Text>
              </li>
              <li>
                <Text type='success'>{t('acp.channelConflict.messagesAvailable')}</Text>
              </li>
            </ul>
          </Paragraph>
          <Paragraph>
            <Text bold>{t('acp.channelConflict.instructions')}</Text>
          </Paragraph>
          <Paragraph>
            <Text type='secondary'>{t('acp.channelConflict.disableTitle', params)}</Text>
            <br />
            {t('acp.channelConflict.edit')}: <Text code>{openclawConfigPath}</Text>
            <br />
            {t('acp.channelConflict.set')}: <Text code>{`channels.${channelKey}.enabled = false`}</Text>
            <br />
            {t('acp.channelConflict.restart')}
          </Paragraph>
          <Paragraph>
            <Text type='secondary'>{t('acp.channelConflict.newBotTitle')}</Text>
            <br />
            {t('acp.channelConflict.newBot', params)}
          </Paragraph>
          <Paragraph>
            <Text type='secondary'>{t('acp.channelConflict.keepTitle')}</Text>
            <br />
            {t('acp.channelConflict.keep', params)}
          </Paragraph>
          <Space>
            {onDisableOpenClaw && (
              <Button type='primary' onClick={onDisableOpenClaw}>
                {t('acp.channelConflict.disableAction', params)}
              </Button>
            )}
            {onIgnore && (
              <Button type='text' onClick={onIgnore}>
                {t('acp.channelConflict.ignore')}
              </Button>
            )}
          </Space>
        </Space>
      }
    />
  );
};

/** Compact channel conflict notice for settings pages. */
export const ChannelConflictBanner: React.FC<{ platform: 'lark' | 'telegram'; onLearnMore: () => void }> = ({
  platform,
  onLearnMore,
}) => {
  const { t } = useTranslation();
  const platformName = platform === 'lark' ? 'Lark/Feishu' : 'Telegram';
  return (
    <Alert
      type='warning'
      className='mb-12px'
      closable
      content={
        <Space>
          <Text>{t('acp.channelConflict.banner', { platform: platformName })}</Text>
          <Link onClick={onLearnMore}>{t('acp.channelConflict.learnMore')}</Link>
        </Space>
      }
    />
  );
};
