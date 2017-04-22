const DelegateOperation = require('./DelegateOperation');
const InsertOperation = require('./InsertOperation');

const insertFuncBuilder = require('../graphInserter/inserter');
const GraphInserter = require('../graphInserter/GraphInserter');

module.exports = class InsertGraphOperation extends DelegateOperation {

  constructor(name, opt) {
    super(name, opt);

    if (!this.delegate.is(InsertOperation)) {
      throw new Error('Invalid delegate');
    }

    // Our delegate operation inherits from `InsertOperation`. Disable the call-time
    // validation. We do the validation in onAfterQuery instead.
    this.delegate.modelOptions.skipValidation = true;

    // We need to split the query props deeply.
    this.delegate.splitQueryPropsDeep = true;
  }

  call(builder, args) {
    const retVal = super.call(builder, args);

    // We resolve this query here and will not execute it. This is because the root
    // value may depend on other models in the graph and cannot be inserted first.
    builder.resolve([]);

    return retVal;
  }

  get models() {
    return this.delegate.models;
  }

  get isArray() {
    return this.delegate.isArray;
  }

  get queryProps() {
    return this.delegate.queryProps;
  }

  onBefore() {
    // Do nothing.
  }

  onBeforeInternal() {
    // Do nothing. We override this with empty implementation so that
    // the $beforeInsert() hooks are not called twice for the root models.
  }

  onBeforeBuild() {
    // Do nothing.
  }

  onBuild() {
    // Do nothing.
  }

  // We overrode all other hooks but this one and do all the work in here.
  // This is a bit hacky.
  onAfterQuery(builder) {
    // We split the query props from all the models in the graph in the
    // InsertOperation.call method. We need to set the queryProps option
    // so that the individual inserts started by insertFunc all get their
    // query properties.
    builder = builder.clone().internalOptions({
      queryProps: this.queryProps
    });

    const ModelClass = builder.modelClass();
    const insertFunc = insertFuncBuilder(builder);

    const graphInserter = new GraphInserter({
      modelClass: ModelClass,
      models: this.models,
      allowedRelations: builder._allowedInsertExpression || null,
      knex: builder.knex()
    });

    return graphInserter.execute(insertFunc).then(() => {
      return super.onAfterQuery(builder, this.models)
    });
  }

  onAfterInternal() {
    // We override this with empty implementation so that the $afterInsert() hooks
    // are not called twice for the root models.
    return this.isArray ? this.models : (this.models[0] || null);
  }
}
