/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button } from '@arco-design/web-react';
import { Config, Peoples, SettingTwo } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import styles from '../index.module.css';

const QuickActionButtons: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <footer className={styles.enterpriseFooter}>
      <div className={styles.internalLinks}>
        <Button type='text' icon={<Config size={14} />} onClick={() => void navigate('/settings/model')}>
          {t('common.product.modelSettings')}
        </Button>
        <Button type='text' icon={<Peoples size={14} />} onClick={() => void navigate('/assistants')}>
          {t('common.product.assistantSettings')}
        </Button>
        <Button type='text' icon={<SettingTwo size={14} />} onClick={() => void navigate('/settings/system')}>
          {t('common.product.platformSettings')}
        </Button>
      </div>
      <p>{t('common.product.usageNotice')}</p>
    </footer>
  );
};

export default QuickActionButtons;
