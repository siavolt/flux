/**
 * @generated
 * @jsx React.DOM
 */
var React = require("React");
var layout = require("DocsLayout");
var content = `
To demonstrate the Flux architecture with some example code, let's take on the classic TodoMVC application. The entire application is available in the React GitHub repo within the [todomvc-flux](https://github.com/facebook/react/tree/master/examples/todomvc-flux) example directory, but let's walk through the development of it a step at a time.

To begin, we'll need some boilerplate and get up and running with a module system. Node's module system, based on CommonJS, will fit the bill very nicely and we can build off of [react-boilerplate](https://github.com/petehunt/react-boilerplate) to get up and running quickly. Assuming you have npm installed, simply clone the react-boilerplate code from GitHub, and navigate into the resulting directory in Terminal (or whatever CLI application you like). Next run the npm scripts to get up and running: \`npm install\`, then \`npm run build\`, and lastly \`npm start\` to continuously build using Browserify.

The TodoMVC example has all this built into it as well, but if you're starting with react-boilerplate make sure you edit your package.json file to match the file structure and dependencies described in the TodoMVC example's [package.json](https://github.com/facebook/react/tree/master/examples/todomvc-flux/package.json), or else your code won't match up with the explanations below.


Source Code Structure
---------------------
The resulting index.js file may be used as the entry point into our app, but we'll put most of our code in a 'js' directory. Let's let Browserify do its thing, and now we'll open a new tab in Terminal (or a GUI file browser) to look at the directory. It should look something like this:

\`\`\`
myapp
  |
  + ...
  + js
    |
    + app.js
    + bundle.js // generated by Browserify whenever we make changes.
  + index.html
  + ...
\`\`\`

Next we'll dive into the js directory, and layout our application's primary directory structure:

\`\`\`
myapp
  |
  + ...
  + js
    |
    + actions
    + components // all React components, both views and controller-views
    + constants
    + dispatcher
    + stores
    + app.js
    + bundle.js
  + index.html
  + ...
\`\`\`

Creating a Dispatcher
---------------------

Now we are ready to create a dispatcher. Here is an naive example of a Dispatcher class, written with JavaScript promises, polyfilled with Jake Archibald's [ES6-Promises](https://github.com/jakearchibald/ES6-Promises) module.

\`\`\`javascript
var Promise = require\('es6-promise').Promise;
var merge = require\('react/lib/merge');

var _callbacks = [];
var _promises = [];

var Dispatcher = function() {};
Dispatcher.prototype = merge(Dispatcher.prototype, {

  /**
   * Register a Store's callback so that it may be invoked by an action.
   * @param {function} callback The callback to be registered.
   * @return {number} The index of the callback within the _callbacks array.
   */
  register: function(callback) {
    _callbacks.push(callback);
    return _callbacks.length - 1; // index
  },

  /**
   * dispatch
   * @param  {object} payload The data from the action.
   */
  dispatch: function(payload) {
    // First create array of promises for callbacks to reference.
    var resolves = [];
    var rejects = [];
    _promises = _callbacks.map(function(_, i) {
      return new Promise(function(resolve, reject) {
        resolves[i] = resolve;
        rejects[i] = reject;
      });
    });
    // Dispatch to callbacks and resolve/reject promises.
    _callbacks.forEach(function(callback, i) {
      // Callback can return an obj, to resolve, or a promise, to chain.
      // See waitFor() for why this might be useful.
      Promise.resolve(callback(payload)).then(function() {
        resolves[i](payload);
      }, function() {
        rejects[i](new Error('Dispatcher callback unsuccessful'));
      });
    });
    _promises = [];
  }
});

module.exports = Dispatcher;
\`\`\`

The public API of this basic Dispatcher consists of only two methods: register() and dispatch(). We'll use register() within our stores to register each store's callback. We'll use dispatch() within our actions to trigger the invocation of the callbacks.

Now we are all set to create a dispatcher that is more specific to our app, which we'll call AppDispatcher.

\`\`\`javascript
var Dispatcher = require\('./Dispatcher');

var merge = require\('react/lib/merge');

var AppDispatcher = merge(Dispatcher.prototype, {

  /**
   * A bridge function between the views and the dispatcher, marking the action
   * as a view action.  Another variant here could be handleServerAction.
   * @param  {object} action The data coming from the view.
   */
  handleViewAction: function(action) {
    this.dispatch({
      source: 'VIEW_ACTION',
      action: action
    });
  }

});

module.exports = AppDispatcher;
\`\`\`

Now we've created an implementation that is a bit more specific to our needs, with a helper function we can use in the actions coming from our views' event handlers. We might expand on this later to provide a separate helper for server updates, but for now this is all we need.


Creating Stores
----------------

We can use Node's EventEmitter to get started with a store. We need EventEmitter to broadcast the 'change' event to our controller-views. So let's take a look at what that looks like. I've omitted some of the code for the sake of brevity, but for the full version see [TodoStore.js](https://github.com/Facebook/react/blob/master/examples/todomvc-flux/js/stores/TodoStore.js) in the TodoMVC example code.

\`\`\`javascript
var AppDispatcher = require\('../dispatcher/AppDispatcher');
var EventEmitter = require\('events').EventEmitter;
var TodoConstants = require\('../constants/TodoConstants');
var merge = require\('react/lib/merge');

var CHANGE_EVENT = 'change';

var _todos = {}; // collection of todo items

/**
 * Create a TODO item.
 * @param {string} text The content of the TODO
 */
function create(text) {
  // Using the current timestamp in place of a real id.
  var id = Date.now();
  _todos[id] = {
    id: id,
    complete: false,
    text: text
  };
}

/**
 * Delete a TODO item.
 * @param {string} id
 */
function destroy(id) {
  delete _todos[id];
}

var TodoStore = merge(EventEmitter.prototype, {

  /**
   * Get the entire collection of TODOs.
   * @return {object}
   */
  getAll: function() {
    return _todos;
  },

  emitChange: function() {
    this.emit(CHANGE_EVENT);
  },

  /**
   * @param {function} callback
   */
  addChangeListener: function(callback) {
    this.on(CHANGE_EVENT, callback);
  },

  /**
   * @param {function} callback
   */
  removeChangeListener: function(callback) {
    this.removeListener(CHANGE_EVENT, callback);
  }

  dispatcherIndex: AppDispatcher.register(function(payload) {
    var action = payload.action;
    var text;

    switch(action.actionType) {
      case TodoConstants.TODO_CREATE:
        text = action.text.trim();
        if (text !== '') {
          create(text);
          TodoStore.emitChange();
        }
        break;

      case TodoConstants.TODO_DESTROY:
        destroy(action.id);
        TodoStore.emitChange();
        break;

      // add more cases for other actionTypes, like TODO_UPDATE, etc.
    }

    return true; // No errors. Needed by promise in Dispatcher.
  })

});

module.exports = TodoStore;
\`\`\`

There are a few important things to note in the above code. To start, we are maintaining a private data structure called _todos. This object contains all the individual to-do items. Because this variable lives outside the class, but within the closure of the module, it remains private — it cannot be directly changed from the outside. This helps us preserve a distinct input/output interface for the flow of data by making it impossible to update the store without using an action.

Another important part is the registration of the store's callback with the dispatcher. We pass in our payload handling callback to the dispatcher and preserve the index that this store has in the dispatcher's registry. The callback function currently only handles two actionTypes, but later we can add as many as we need.


Listening to Changes with a Controller-View
-------------------------------------------

We need a React component near the top of our component hierarchy to listen for changes in the store. In a larger app, we would have more of these listening components, perhaps one for every section of the page. In Facebook's Ads Creation Tool, we have many of these controller-like views, each governing a specific section of the UI. In the Lookback Video Editor, we only had two: one for the animated preview and one for the image selection interface. Here's one for our TodoMVC example. Again, this is slightly abbreviated, but for the full code you can take a look at the TodoMVC example's [TodoApp.react.js](https://github.com/facebook/react/blob/master/examples/todomvc-flux/js/components/TodoApp.react.js)

\`\`\`javascript
/** @jsx React.DOM */

var Footer = require\('./Footer.react');
var Header = require\('./Header.react');
var MainSection = require\('./MainSection.react');
var React = require\('react');
var TodoStore = require\('../stores/TodoStore');

function getTodoState() {
  return {
    allTodos: TodoStore.getAll()
  };
}

var TodoApp = React.createClass({

  getInitialState: function() {
    return getTodoState();
  },

  componentDidMount: function() {
    TodoStore.addChangeListener(this._onChange);
  },

  componentWillUnmount: function() {
    TodoStore.removeChangeListener(this._onChange);
  },

  /**
   * @return {object}
   */
  render: function() {
    return (
      <div>
        <Header />
        <MainSection
          allTodos={this.state.allTodos}
          areAllComplete={this.state.areAllComplete}
        />
        <Footer allTodos={this.state.allTodos} />
      </div>
    );
  },

  _onChange: function() {
    this.setState(getTodoState());
  }

});

module.exports = TodoApp;
\`\`\`

Now we're in our familiar React territory, utilizing React's lifecycle methods. We set up the initial state of this controller-view in getInitialState(), register an event listener in componentDidMount(), and then clean up after ourselves within componentWillUnmount(). We render a containing div and pass down the collection of states we got from the TodoStore.

The Header component contains the primary text input for the application, but it does not need to know the state of the store. The MainSection and Footer do need this data, so we pass it down to them.

More Views
----------
At a high level, the React component hierarchy of the app looks like this:

\`\`\`javascript
<TodoApp>
  <Header>
    <TodoTextInput />

    <MainSection>
      <ul>
        <TodoItem />
      </ul>
    </MainSection>

</TodoApp>
\`\`\`
If a TodoItem is in edit mode, it will also render a TodoTextInput as a child. Let's take a look at how some of these components display the data they receive as props, and how they communicate through actions with the dispatcher.
The MainSection needs to iterate over the collection of to-do items it received from TodoApp to create the list of TodoItems. In the component's render() method, we can do that iteration like so:

\`\`\`javascript
var allTodos = this.props.allTodos;

for (var key in allTodos) {
  todos.push(<TodoItem key={key} todo={allTodos[key]} />);
}

return (
  <section id="main">
  <ul id="todo-list">{todos}</ul>
);
\`\`\`
Now each TodoItem can display it's own text, and perform actions utilizing it's own ID. Explaining all the different actions that a TodoItem can invoke in the TodoMVC example goes beyond the scope of this article, but let's just take a look at the action that deletes one of the to-do items. Here is an abbreviated version of the TodoItem:

\`\`\`javascript
/** @jsx React.DOM */

var React = require\('react');
var TodoActions = require\('../actions/TodoActions');
var TodoTextInput = require\('./TodoTextInput.react');

var TodoItem = React.createClass({

  propTypes: {
    todo: React.PropTypes.object.isRequired
  },

  render: function() {
    var todo = this.props.todo;

    return (
      <li
        key={todo.id}>
        <label>
          {todo.text}
        </label>
        <button className="destroy" onClick={this._onDestroyClick} />
      </li>
    );
  },

  _onDestroyClick: function() {
    TodoActions.destroy(this.props.todo.id);
  }

});

module.exports = TodoItem;
\`\`\`

With a destroy action available in our library of TodoActions, and a store ready to handle it, connecting the user's interaction with application state changes could not be simpler. We just wrap our onClick handler around the destroy action, provide it with the id, and we're done. Now the user can click the destroy button and kick off the Flux cycle to update the rest of the application.

Text input, on the other hand, is just a bit more complicated because we need to hang on to the state of the text input within the React component itself. Let's take a look at how TodoTextInput works.

As you'll see below, with every change to the input, React expects us to update the state of the component. So when we are finally ready to save the text inside the input, we will put the value held in the component's state in the action's payload. This is UI state, rather than application state, and keeping that distinction in mind is a good guide for where state should live. All application state should live in the store, while components occasionally hold on to UI state. Ideally, React components preserve as little state as possible.

Because TodoTextInput is being used in multiple places within our application, with different behaviors, we'll need to pass the onSave method in as a prop from the component's parent. This allows onSave to invoke different actions depending on where it is used.

\`\`\`javascript
/** @jsx React.DOM */

var React = require\('react');
var ReactPropTypes = React.PropTypes;

var ENTER_KEY_CODE = 13;

var TodoTextInput = React.createClass({

  propTypes: {
    className: ReactPropTypes.string,
    id: ReactPropTypes.string,
    placeholder: ReactPropTypes.string,
    onSave: ReactPropTypes.func.isRequired,
    value: ReactPropTypes.string
  },

  getInitialState: function() {
    return {
      value: this.props.value || ''
    };
  },

  /**
   * @return {object}
   */
  render: function() /*object*/ {
    return (
      <input
        className={this.props.className}
        id={this.props.id}
        placeholder={this.props.placeholder}
        onBlur={this._save}
        onChange={this._onChange}
        onKeyDown={this._onKeyDown}
        value={this.state.value}
        autoFocus={true}
      />
    );
  },

  /**
   * Invokes the callback passed in as onSave, allowing this component to be
   * used in different ways.
   */
  _save: function() {
    this.props.onSave(this.state.value);
    this.setState({
      value: ''
    });
  },

  /**
   * @param {object} event
   */
  _onChange: function(/*object*/ event) {
    this.setState({
      value: event.target.value
    });
  },

  /**
   * @param {object} event
   */

  _onKeyDown: function(event) {
    if (event.keyCode === ENTER_KEY_CODE) {
      this._save();
    }
  }

});

module.exports = TodoTextInput;
\`\`\`

The Header passes in the onSave method as a prop to allow the TodoTextInput to create new
to-do items:

\`\`\`javascript
/** @jsx React.DOM */

var React = require\('react');
var TodoActions = require\('../actions/TodoActions');
var TodoTextInput = require\('./TodoTextInput.react');

var Header = React.createClass({

  /**
   * @return {object}
   */
  render: function() {
    return (
      <header id="header">
        <h1>todos</h1>
        <TodoTextInput
          id="new-todo"
          placeholder="What needs to be done?"
          onSave={this._onSave}
        />
      </header>
    );
  },

  /**
   * Event handler called within TodoTextInput.
   * Defining this here allows TodoTextInput to be used in multiple places
   * in different ways.
   * @param {string} text
   */
  _onSave: function(text) {
    TodoActions.create(text);
  }

});

module.exports = Header;
\`\`\`

In a different context, such as in editing mode for an existing to-do item, we might pass an onSave callback that invokes \`TodoActions.update(text)\` instead.


Creating Semantic Actions
-------------------------

Here is the basic code for the two actions we used above in our views:

\`\`\`javascript
/**
 * TodoActions
 */

var AppDispatcher = require\('../dispatcher/AppDispatcher');
var TodoConstants = require\('../constants/TodoConstants');

var TodoActions = {

  /**
   * @param  {string} text
   */
  create: function(text) {
    AppDispatcher.handleViewAction({
      actionType: TodoConstants.TODO_CREATE,
      text: text
    });
  },

  /**
   * @param  {string} id
   */
  destroy: function(id) {
    AppDispatcher.handleViewAction({
      actionType: TodoConstants.TODO_DESTROY,
      id: id
    });
  },

};

module.exports = TodoActions;
\`\`\`

As you can see, we really would not need to have the helpers AppDispatcher.handleViewAction() or TodoActions.create(). We could, in theory, call AppDispatcher.dispatch() directly and provide a payload. But as our application grows, having these helpers keeps the code clean and semantic. It's just a lot cleaner to write TodoActions.destroy(id) instead of writing a whole lot of things that our TodoItem shouldn't have to know about.

The payload produced by the TodoActions.create() will look like:

\`\`\`javascript
{
  source: 'VIEW_ACTION',
  action: {
    type: 'TODO_CREATE',
    text: 'Write blog post about Flux'
  }
}
\`\`\`

This payload is provided to the TodoStore through its registered callback. The TodoStore then broadcasts the 'change' event, and the MainSection responds by fetching the new collection of to-do items from the TodoStore and changing its state. This change in state causes the TodoApp component to call its own render() method, and the render() method of all of its descendents.

Start Me Up
-----------

The bootstrap file of our application is app.js. It simply takes the TodoApp component and renders it in the root element of the application.

\`\`\`javascript
/** @jsx React.DOM */

var React = require\('react');

var TodoApp = require\('./components/TodoApp.react');

React.renderComponent(
  <TodoApp />,
  document.getElementById('todoapp')
);
\`\`\`

Adding Dependency Management to the Dispatcher
----------------------------------------------

As I said previously, our Dispatcher implementation is a bit naive. It's pretty good, but it will not suffice for most applications. We need a way to be able to manage dependencies between Stores. Let's add that functionality with a waitFor() method within the main body of the Dispatcher class.

We'll need another public method, waitFor(). Note that it returns a Promise that can in turn be returned from the Store callback.

\`\`\`javascript
  /**
   * @param  {array} promisesIndexes
   * @param  {function} callback
   */
  waitFor: function(promiseIndexes, callback) {
    var selectedPromises = promiseIndexes.map(function(index) {
      return _promises[index];
    });
    return Promise.all(selectedPromises).then(callback);
  }
\`\`\`

Now within the TodoStore callback we can explicitly wait for any dependencies to first update before moving forward.  However, if Store A waits for Store B, and B waits for A, then a circular dependency will occur.  A more robust dispatcher is required to flag this scenario with warnings in the console.

The Future of Flux
------------------

A lot of people ask if Facebook will release Flux as an open source framework. Really, Flux is just an architecture, not a framework.  But perhaps a Flux boilerplate project might make sense, if there is enough interest. Please let us know if you'd like to see us do this.

Thanks for taking the time to read about how we build client-side applications at Facebook. We hope Flux proves as useful to you as it has to us.
`
var Post = React.createClass({
  render: function() {
    return layout({metadata: {"id":"todo-list","title":"Todo List","layout":"docs","category":"Quick Start","permalink":"docs/todo-list.html","next":"dispatcher"}}, content);
  }
});
Post.content = content;
module.exports = Post;
