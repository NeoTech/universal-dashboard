import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { StatusBar } from '../panels/StatusBar';

describe('StatusBar', () => {
  afterEach(cleanup);

  it('renders the workspace name', () => {
    const { getByText } = render(() => (
      <StatusBar focusedPanelId="panel-a" workspaceName="my-workspace" />
    ));
    expect(getByText('my-workspace')).toBeTruthy();
  });

  it('renders the focused panel id', () => {
    const { getByText } = render(() => (
      <StatusBar focusedPanelId="panel-a" workspaceName="default" />
    ));
    expect(getByText('panel-a')).toBeTruthy();
  });

  it('has x-data attribute on root element for Alpine', () => {
    const { container } = render(() => (
      <StatusBar focusedPanelId="p1" workspaceName="ws" />
    ));
    const root = container.querySelector('.status-bar');
    expect(root).toBeTruthy();
    expect(root!.hasAttribute('x-data')).toBe(true);
  });

  it('contains a clock element with x-text', () => {
    const { container } = render(() => (
      <StatusBar focusedPanelId="p1" workspaceName="ws" />
    ));
    const clock = container.querySelector('.status-bar__clock');
    expect(clock).toBeTruthy();
    expect(clock!.getAttribute('x-text')).toBe('time');
  });

  it('updates displayed focusedPanelId reactively', () => {
    const [id, setId] = createSignal('initial');
    const { getByTestId } = render(() => (
      <StatusBar focusedPanelId={id()} workspaceName="ws" />
    ));
    expect(getByTestId('focused-id').textContent).toBe('initial');
    setId('updated');
    expect(getByTestId('focused-id').textContent).toBe('updated');
  });
});
