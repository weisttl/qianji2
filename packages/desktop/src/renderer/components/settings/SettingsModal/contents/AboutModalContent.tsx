/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import brandMark from '@renderer/assets/logos/brand/qianji-mark.svg';
import { useNavigate } from 'react-router-dom';
import { Divider, Typography, Button } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

declare const __APP_VERSION__: string;

const AboutModalContent: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className='flex flex-col items-center max-w-600px mx-auto px-24px py-24px text-center'>
      <img src={brandMark} alt='' width={68} height={68} className='mb-20px' />
      <Typography.Title heading={3}>{t('common.product.name')}</Typography.Title>
      <Typography.Text className='text-brand text-13px tracking-2px mb-16px'>
        {t('common.product.organization')} · {t('common.product.edition')}
      </Typography.Text>
      <Typography.Paragraph className='text-t-secondary leading-7'>
        {t('common.product.description')}
      </Typography.Paragraph>
      <span className='px-12px py-4px rd-6px bg-2 text-t-secondary text-12px'>v{__APP_VERSION__}</span>
      <Divider />
      <div className='text-start w-full flex flex-col gap-16px text-13px text-t-secondary leading-6'>
        <p>{t('common.product.connectionNotice')}</p>
        <p>{t('common.product.updatesNotice')}</p>
        <p>{t('common.product.support')}</p>
      </div>
      <Button className='mt-24px' type='primary' onClick={() => void navigate('/settings/model')}>
        {t('common.product.modelSettings')}
      </Button>
      <Divider />
      <Typography.Text className='text-12px text-t-secondary'>{t('common.product.upstreamNotice')}</Typography.Text>
    </div>
  );
};

export default AboutModalContent;
