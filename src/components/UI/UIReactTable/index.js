import React from "react";

import { Table } from "semantic-ui-react";

export const IndeterminateCheckbox = React.forwardRef(
  ({ indeterminate, ...rest }, ref) => {
    const defaultRef = React.useRef();
    const resolvedRef = ref || defaultRef;

    React.useEffect(() => {
      resolvedRef.current.indeterminate = indeterminate;
    }, [resolvedRef, indeterminate]);

    return (
      <>
        <input type="checkbox" ref={resolvedRef} {...rest} />
      </>
    );
  }
);

export const SelectableHook = (columns) => {
  return (hooks) => {
    hooks.visibleColumns.push((columns) => [
      {
        id: "selection",
        Header: ({ getToggleAllRowsSelectedProps }) => (
          <div>
            <IndeterminateCheckbox {...getToggleAllRowsSelectedProps()} />
          </div>
        ),
        Cell: ({ row }) => (
          <div>
            <IndeterminateCheckbox {...row.getToggleRowSelectedProps()} />
          </div>
        ),
      },
      ...columns,
    ]);
  };
};

export default function UIReactTable({
  getTableProps,
  getTableBodyProps,
  headerGroups,
  rows,
  prepareRow,
}) {
  var addressColumns = {
    street: true,
    state: true,
    city: true,
    zipCode: true,
    apartment: true,
  };

  return (
    <Table {...getTableProps()}>
      <Table.Header>
        {headerGroups.map((headerGroup) => (
          <Table.Row {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map((column) => (
              <Table.HeaderCell {...column.getHeaderProps()}>
                {column.render("Header")}
                <div>{column.filter ? column.render("Filter") : null}</div>
              </Table.HeaderCell>
            ))}
          </Table.Row>
        ))}
      </Table.Header>
      <Table.Body {...getTableBodyProps()}>
        {rows.map((row, i) => {
          prepareRow(row);
          return [
            <Table.Row {...row.getRowProps()}>
              {row.cells.map((cell) => {
                return (
                  <Table.Cell
                    {...cell.getCellProps()}
                    error={
                      (row.original.invalidField === "address" &&
                        addressColumns[cell.column.id]) ||
                      (row.original.invalidField === "phoneNumber" &&
                        cell.column.id === "phoneNumber") ||
                      (row.original.invalidField === "email" &&
                        cell.column.id === "email")
                    }>
                    {cell.render("Cell")}
                  </Table.Cell>
                );
              })}
            </Table.Row>,
            row.original.errorMessage && (
              <Table.Row {...row.getRowProps()} key={"error_row_" + i}>
                <Table.Cell error={true} colSpan={row.cells.length}>
                  {row.original.errorMessage}
                </Table.Cell>
              </Table.Row>
            ),
            row.original.warningMessage && (
              <Table.Row {...row.getRowProps()} key={"warning_row_" + i}>
                <Table.Cell warning={true} colSpan={row.cells.length}>
                  {row.original.warningMessage}
                </Table.Cell>
              </Table.Row>
            ),
          ];
        })}
      </Table.Body>
    </Table>
  );
}
