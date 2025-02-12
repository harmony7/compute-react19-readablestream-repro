import * as React from 'react';

// This a React component that is not 'async'
export default function Container({children}) {
  return <div>{children}</div>;
}
