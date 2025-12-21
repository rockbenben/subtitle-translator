import React, { memo } from "react";
import { Button, Form, Input, Space, Tooltip } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";

import type { KeyMapping } from "@/app/types";

interface KeyMappingInputProps {
  keyMappings: KeyMapping[];
  setKeyMappings: React.Dispatch<React.SetStateAction<KeyMapping[]>>;
}

const KeyMappingInput: React.FC<KeyMappingInputProps> = ({ keyMappings = [], setKeyMappings }) => {
  const t = useTranslations("json");

  const deleteMapping = (id: number) => {
    if (keyMappings.length > 1) {
      const newMappings = keyMappings.filter((mapping) => mapping.id !== id);
      setKeyMappings(newMappings);
    }
  };

  const addMapping = () => {
    setKeyMappings([...keyMappings, { inputKey: "", outputKey: "", id: Date.now() + Math.random() }]);
  };

  const handleInputChange = (index: number, field: "inputKey" | "outputKey", value: string) => {
    const newMappings = [...keyMappings];
    newMappings[index][field] = value;
    setKeyMappings(newMappings);
  };

  return (
    <>
      {keyMappings.map((mapping, index) => (
        <div key={mapping.id} className="flex mb-2">
          <Space align="baseline">
            <Form.Item label={`${t("inputKey")} ${index + 1}`} className="mb-0">
              <Input value={mapping.inputKey} onChange={(e) => handleInputChange(index, "inputKey", e.target.value)} />
            </Form.Item>
            <Form.Item label={`${t("outputKey")} ${index + 1}`} className="mb-0">
              <Input value={mapping.outputKey} onChange={(e) => handleInputChange(index, "outputKey", e.target.value)} />
            </Form.Item>
            <Tooltip title={t("deleteMapping")}>
              <Button onClick={() => deleteMapping(mapping.id)} type="default" icon={<MinusCircleOutlined />} />
            </Tooltip>
          </Space>
        </div>
      ))}
      <Button type="dashed" block onClick={addMapping} icon={<PlusOutlined />} className="mb-2">
        {t("addMapping")}
      </Button>
    </>
  );
};

export default memo(KeyMappingInput);
