import React, { useState } from "react";
import { camelCase } from "camel-case";
import CSVReader from "react-csv-reader";
import UIEditableTable from "../UIEditableTable";

export default function Importer({
  columns,
  save,
  dataFormatter,
  dataProcesser,
  saveButtonText,
  transformHeader,
  onEdit,
  loading,
  disabled,
  disableRenderTable,
  label,
}) {
  const [showTable, setShowTable] = useState(false);
  const [data, setData] = useState([]);

  const renderTable = !disableRenderTable;

  const papaparseOptions = {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    transformHeader: (header) => {
      if (transformHeader) {
        return transformHeader(header);
      }
      return camelCase(header);
    },
  };

  const onFileLoaded = (data) => {
    if (dataFormatter) {
      data = dataFormatter(data);
    }
    if (renderTable) {
      setData(data);
      setShowTable(true);
    }
    if (dataProcesser) {
      Promise.resolve(dataProcesser(data, setData));
    }
  };

  return (
    <div style={{ margin: "10px" }}>
      <CSVReader
        cssClass="react-csv-input"
        label={label}
        onFileLoaded={onFileLoaded}
        parserOptions={papaparseOptions}
      />
      {showTable && (
        <UIEditableTable
          save={save}
          data={data}
          setData={setData}
          columns={columns}
          saveButtonText={saveButtonText}
          loading={loading}
          disabled={disabled}
          onEdit={onEdit}
        />
      )}
    </div>
  );
}
