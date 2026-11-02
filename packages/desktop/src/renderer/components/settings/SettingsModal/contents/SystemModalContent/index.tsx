/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { configService } from '@/common/config/configService';
import QianjiScrollArea from '@/renderer/components/base/QianjiScrollArea';
import LanguageSwitcher from '@/renderer/components/settings/LanguageSwitcher';
import { useCrossSessionMessageEnabled } from '@/renderer/hooks/chat/useCrossSessionMessageEnabled';
import { getClientBusinessSetting, setClientBusinessSetting } from '@/renderer/services/clientBusinessSettings';
import {
  DEFAULT_TEXT_PREVIEW_LIMIT_MB,
  MAX_TEXT_PREVIEW_LIMIT_MB,
  MIN_TEXT_PREVIEW_LIMIT_MB,
  normalizeTextPreviewLimitMb,
} from '@/renderer/utils/file/previewPayload';
import { Collapse, InputNumber, Message, Switch } from '@arco-design/web-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsViewMode } from '../../settingsViewContext';
import BrowserNotificationGrant from './BrowserNotificationGrant';
import PreferenceRow from './PreferenceRow';
import VoiceInputSection from './VoiceInputSection';

/**
 * System settings content component
 *
 * Provides browser preferences and server-backed conversation settings.
 */
const SystemModalContent: React.FC = () => {
  const { t } = useTranslation();
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [promptTimeout, setPromptTimeout] = useState<number>(300);
  const [agentIdleTimeout, setAgentIdleTimeout] = useState<number>(5);
  /**
   * The committed limit — what is stored, and what the field falls back to.
   *
   * The field itself is left uncontrolled while typing. Arco's `InputNumber` skips its
   * internal "user is typing" state whenever a `value` prop is present, and then
   * renders the number it parsed rather than the characters that were entered. `1.` is
   * not a number, so the dot was dropped on the keystroke that produced it and `1.5`
   * came out as `15`.
   *
   * Remounting on commit (via `key`) is what lets an uncontrolled field still show a
   * clamped result: type `0.2`, blur, and the field comes back as the accepted `1`.
   */
  const [previewLimitMb, setPreviewLimitMb] = useState<number>(DEFAULT_TEXT_PREVIEW_LIMIT_MB);
  const previewLimitDraftRef = useRef<string>(String(DEFAULT_TEXT_PREVIEW_LIMIT_MB));
  const [saveUploadToWorkspace, setSaveUploadToWorkspace] = useState(false);

  useEffect(() => {
    setNotificationEnabled(configService.get('system.notificationEnabled') ?? true);
    setSaveUploadToWorkspace(configService.get('upload.saveToWorkspace') ?? false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadAcpTimeouts = async () => {
      try {
        const [storedPromptTimeout, storedAgentIdleTimeout, storedPreviewLimitMb] = await Promise.all([
          getClientBusinessSetting('acp.promptTimeout'),
          getClientBusinessSetting('acp.agentIdleTimeout'),
          getClientBusinessSetting('preview.textSizeLimitMb'),
        ]);
        if (cancelled) {
          return;
        }

        if (typeof storedPromptTimeout === 'number' && storedPromptTimeout > 0) {
          setPromptTimeout(storedPromptTimeout);
        }
        if (typeof storedAgentIdleTimeout === 'number' && storedAgentIdleTimeout > 0) {
          setAgentIdleTimeout(storedAgentIdleTimeout);
        }
        // Normalized rather than range-checked inline: the same clamp guards the
        // stored value, the field, and the size check, so a hand-edited or legacy
        // entry cannot present one limit here and apply another when a file opens.
        if (storedPreviewLimitMb !== undefined) {
          const stored = normalizeTextPreviewLimitMb(storedPreviewLimitMb);
          setPreviewLimitMb(stored);
          previewLimitDraftRef.current = String(stored);
        }
      } catch {
        // Keep the in-memory defaults when backend settings are unavailable.
      }
    };

    void loadAcpTimeouts();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleNotificationEnabledChange = useCallback((checked: boolean) => {
    setNotificationEnabled(checked);
    configService.set('system.notificationEnabled', checked).catch(() => {
      setNotificationEnabled(!checked);
      configService.setLocal('system.notificationEnabled', !checked);
    });
  }, []);

  const handlePromptTimeoutChange = useCallback((val: number | undefined) => {
    setPromptTimeout(val as number);
  }, []);

  const handlePromptTimeoutBlur = useCallback(() => {
    const clamped = Math.max(30, Math.min(3600, promptTimeout || 300));
    setPromptTimeout(clamped);
    void setClientBusinessSetting('acp.promptTimeout', clamped).catch(() => {});
  }, [promptTimeout]);

  const handleAgentIdleTimeoutChange = useCallback((val: number | undefined) => {
    setAgentIdleTimeout(val as number);
  }, []);

  const handleAgentIdleTimeoutBlur = useCallback(() => {
    const clamped = Math.max(1, Math.min(60, agentIdleTimeout || 5));
    setAgentIdleTimeout(clamped);
    void setClientBusinessSetting('acp.agentIdleTimeout', clamped).catch(() => {});
  }, [agentIdleTimeout]);

  /**
   * Keep what the user typed, not a number parsed from it.
   *
   * A decimal is typed one character at a time, and `1.` is a necessary intermediate
   * state on the way to `1.5`. Storing it as a number turns it back into `1`, the
   * controlled value re-renders the field as `"1"`, and the trailing dot is gone
   * before the next keystroke arrives — so `1.5` came out as `15`. Holding the raw
   * string lets the dot survive until the value is actually used.
   *
   * Nothing downstream sees this string: {@link handlePreviewLimitMbBlur} is the only
   * writer, and it normalizes first.
   */
  const handlePreviewLimitMbChange = useCallback((val: number | string) => {
    previewLimitDraftRef.current = val === undefined || val === null ? '' : String(val);
  }, []);

  /**
   * Persist on blur, not on every keystroke: the field is cleared to empty while
   * retyping, and writing that intermediate state would store a limit the user never
   * chose. The clamp runs here too, so the stored value is always one the size check
   * would accept.
   *
   * Only newly opened preview tabs see the new limit — tabs already open captured
   * theirs when they opened. That is deliberate: reclassifying an open tab would move
   * a file being edited into the "too large to show" state mid-edit.
   */
  const handlePreviewLimitMbBlur = useCallback(() => {
    const typed = previewLimitDraftRef.current.trim();
    // An emptied field means "unset", which normalize turns into the default; Number('')
    // would be 0 and clamp up to the minimum instead, silently choosing for the user.
    const clamped = normalizeTextPreviewLimitMb(typed === '' ? undefined : Number(typed));
    setPreviewLimitMb(clamped);
    previewLimitDraftRef.current = String(clamped);
    void setClientBusinessSetting('preview.textSizeLimitMb', clamped).catch(() => {});
  }, []);

  // Cross-session messaging master switch. Unlike its neighbours this one is a
  // typed column on `system_settings`, so it goes through `PATCH /api/settings`
  // (the hook owns that call); `changeLanguage` on this same page is the
  // precedent for the different channel.
  const { enabled: crossSessionMessageEnabled, setEnabled: setCrossSessionMessageEnabled } =
    useCrossSessionMessageEnabled();
  const handleCrossSessionMessageChange = useCallback(
    (checked: boolean) => {
      void setCrossSessionMessageEnabled(checked).catch(() => {
        // The hook already rolled the local state back; surface the failure so
        // the user does not believe a panic button took effect when it did not.
        Message.error(t('settings.crossSessionMessageUpdateFailed'));
      });
    },
    [setCrossSessionMessageEnabled, t]
  );

  const handleSaveUploadToWorkspaceChange = useCallback((checked: boolean) => {
    setSaveUploadToWorkspace(checked);
    configService.set('upload.saveToWorkspace', checked).catch(() => {
      setSaveUploadToWorkspace(!checked);
      configService.setLocal('upload.saveToWorkspace', !checked);
    });
  }, []);

  const preferenceItems = [
    { key: 'language', label: t('settings.language'), component: <LanguageSwitcher /> },
    {
      key: 'promptTimeout',
      label: t('settings.promptTimeout'),
      component: (
        <InputNumber
          value={promptTimeout}
          onChange={handlePromptTimeoutChange}
          onBlur={handlePromptTimeoutBlur}
          max={3600}
          step={30}
          style={{ width: 120 }}
          suffix='s'
        />
      ),
    },
    {
      key: 'agentIdleTimeout',
      label: t('settings.agentIdleTimeout'),
      description: t('settings.agentIdleTimeoutDesc'),
      component: (
        <InputNumber
          value={agentIdleTimeout}
          onChange={handleAgentIdleTimeoutChange}
          onBlur={handleAgentIdleTimeoutBlur}
          max={60}
          step={5}
          style={{ width: 120 }}
          suffix='min'
        />
      ),
    },
    {
      key: 'previewTextSizeLimit',
      label: t('settings.previewTextSizeLimit'),
      description: t('settings.previewTextSizeLimitDesc'),
      component: (
        <InputNumber
          key={`preview-limit-${previewLimitMb}`}
          defaultValue={previewLimitMb}
          onChange={handlePreviewLimitMbChange}
          onBlur={handlePreviewLimitMbBlur}
          min={MIN_TEXT_PREVIEW_LIMIT_MB}
          max={MAX_TEXT_PREVIEW_LIMIT_MB}
          step={0.5}
          style={{ width: 120 }}
          suffix='MB'
        />
      ),
    },
    {
      key: 'saveUploadToWorkspace',
      label: t('settings.saveUploadToWorkspace'),
      component: <Switch checked={saveUploadToWorkspace} onChange={handleSaveUploadToWorkspaceChange} />,
    },
    {
      // Positive wording, default on (spec §5.7): every other switch on this
      // page is phrased affirmatively, and a negated one would read as a double
      // negative next to them.
      key: 'crossSessionMessage',
      label: t('settings.crossSessionMessage'),
      description: t('settings.crossSessionMessageDesc'),
      component: <Switch checked={crossSessionMessageEnabled} onChange={handleCrossSessionMessageChange} />,
    },
  ];

  return (
    <div className='flex flex-col h-full w-full'>
      <QianjiScrollArea className='flex-1 min-h-0 pb-16px' disableOverflow={isPageMode}>
        <div className='space-y-16px'>
          <div className='px-[12px] md:px-[32px] py-16px bg-2 rd-16px space-y-12px'>
            <div className='w-full flex flex-col divide-y divide-border-2'>
              {preferenceItems.map((item) => (
                <PreferenceRow key={item.key} label={item.label} description={item.description}>
                  {item.component}
                </PreferenceRow>
              ))}
            </div>
            {/* Notification settings with collapsible sub-options */}
            <Collapse
              bordered={false}
              activeKey={notificationEnabled ? ['notification'] : []}
              onChange={(_, keys) => {
                const shouldExpand = (keys as string[]).includes('notification');
                if (shouldExpand && !notificationEnabled) {
                  handleNotificationEnabledChange(true);
                } else if (!shouldExpand && notificationEnabled) {
                  handleNotificationEnabledChange(false);
                }
              }}
              className='[&_.arco-collapse-item]:!border-none [&_.arco-collapse-item-header]:!px-0 [&_.arco-collapse-item-header-title]:!flex-1 [&_.arco-collapse-item-content-box]:!px-0 [&_.arco-collapse-item-content-box]:!pb-0'
            >
              <Collapse.Item
                name='notification'
                showExpandIcon={false}
                header={
                  <div className='flex flex-1 items-center justify-between w-full'>
                    <span className='text-14px text-2 ms-12px'>{t('settings.notification')}</span>
                    <Switch
                      checked={notificationEnabled}
                      onClick={(e) => e.stopPropagation()}
                      onChange={handleNotificationEnabledChange}
                    />
                  </div>
                }
              >
                <BrowserNotificationGrant />
              </Collapse.Item>
            </Collapse>
          </div>

          {/* Voice input (speech-to-text) settings */}
          <VoiceInputSection />
        </div>
      </QianjiScrollArea>
    </div>
  );
};

export default SystemModalContent;
