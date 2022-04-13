import React, { useState } from "react";
import UIReactTable from "../UIReactTable";
import { useTable } from "react-table";
import UIButton from "../UIButton";

export default function UIEditableTable({
  data,
  setData,
  save,
  columns,
  saveButtonText,
  loading,
  disabled,
  disableSaveButton,
  onEdit,
  disableEdit = false,
}) {
  const showSaveButton = !disableSaveButton;
  const renderCell = () => ({
    Cell: ({ data, cell: { value }, row: { index }, column: { id } }) => {
      const [newVal, setValue] = useState(value || "");
      const onChange = (e) => {
        setValue(e.target.value);
      };

      // update data done editing
      const onBlur = () => {
        let datum = data[index];
        if (!datum) {
          console.error("no data cannot edit");
          return;
        }
        // checking to see if anything changed...
        // nothing changed, nothing to do here
        if (datum[id] === newVal) {
          return;
        }
        datum[id] = newVal;
        if (onEdit) {
          Promise.resolve(onEdit(id, datum)).then((resolved) => {
            datum = resolved;
            data[index] = datum;
            setData(data);
          });
        } else {
          data[index] = datum;
          setData(data);
        }
      };
      if (disableEdit) {
        return <div>{newVal}</div>;
      }
      return <input value={newVal} onChange={onChange} onBlur={onBlur} />;
    },
  });
  const defaultColumn = React.useMemo(renderCell, [renderCell, data]);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable({
    autoResetSelectedRows: false,
    columns,
    data,
    defaultColumn,
  });

  const text = saveButtonText ? saveButtonText(data) : "save";

  return (
    <>
      <div style={{ overflowX: "scroll", margin: "10px 0" }}>
        <UIReactTable
          getTableProps={getTableProps}
          getTableBodyProps={getTableBodyProps}
          headerGroups={headerGroups}
          rows={rows}
          prepareRow={prepareRow}
        />
      </div>
      {showSaveButton && (
        <UIButton
          text={text}
          onClick={() => save(data)}
          primary
          loading={loading}
          disabled={disabled}
        />
      )}
    </>
  );
}
