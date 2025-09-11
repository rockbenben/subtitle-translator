"use client";
import React, { useState } from "react";
import { Modal, Form, Input, Tabs, Button, Space } from "antd";
import { useAuth } from "@/app/components/AuthContext";

export default function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login, register, baseUrl, setBaseUrl } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("login");

  const onLogin = async (values: any) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (values: any) => {
    setLoading(true);
    try {
      await register(values.email, values.password, values.name);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Server Sign In" open={open} onCancel={onClose} footer={null}>
      <Space direction="vertical" className="w-full">
        <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} addonBefore="Server" />
        <Tabs activeKey={tab} onChange={setTab as any} items={[
          { key: "login", label: "Login", children: (
            <Form layout="vertical" onFinish={onLogin}>
              <Form.Item name="email" label="Email" rules={[{ required: true }]}>
                <Input type="email" />
              </Form.Item>
              <Form.Item name="password" label="Password" rules={[{ required: true, min: 8 }]}>
                <Input.Password />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>Login</Button>
            </Form>
          )},
          { key: "register", label: "Register", children: (
            <Form layout="vertical" onFinish={onRegister}>
              <Form.Item name="name" label="Name">
                <Input />
              </Form.Item>
              <Form.Item name="email" label="Email" rules={[{ required: true }]}>
                <Input type="email" />
              </Form.Item>
              <Form.Item name="password" label="Password" rules={[{ required: true, min: 8 }]}>
                <Input.Password />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>Register</Button>
            </Form>
          )}
        ]} />
      </Space>
    </Modal>
  );
}

