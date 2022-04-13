import React, { useEffect } from "react";
import { useTable, useRowSelect } from "react-table";
import UIReactTable, { SelectableHook } from "../UI/UIReactTable";

export default function Table({
  columns,
  data,
  onSelect,
  selectedData,
  disableSelect,
}) {
  let hooks = [];
  if (!disableSelect) {
    hooks = [useRowSelect, SelectableHook(columns)];
  }
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    selectedFlatRows,
    toggleRowSelected,
  } = useTable(
    {
      autoResetSelectedRows: false,
      columns,
      data,
    },
    ...hooks
  );

  useEffect(() => {
    // reset selected values on new render. we're assuming the selectedData is set to [] on each new render
    if (selectedData && selectedData.length === 0) {
      rows.forEach((row) => {
        let selected = false;
        for (let i = 0; i < selectedData.length; i++) {
          if (row.original.id === selectedData[i].id) {
            selected = true;
            break;
          }
        }
        toggleRowSelected(row.id, selected);
      });
    }
  }, [selectedData, toggleRowSelected, rows]);

  useEffect(() => {
    if (onSelect) {
      onSelect(selectedFlatRows);
    }
  }, [selectedFlatRows, onSelect]);

  return (
    <UIReactTable
      getTableProps={getTableProps}
      getTableBodyProps={getTableBodyProps}
      headerGroups={headerGroups}
      rows={rows}
      prepareRow={prepareRow}
    />
  );
}
