import './Button.css'

function Button({ children, ...rest }) {
  return (
    <button type="button" className="ui-button" {...rest}>
      {children}
    </button>
  )
}

export default Button
