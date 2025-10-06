import { ForeignKeyConstraintError, Model, ModelStatic } from "sequelize";

export const findMissingForeignKeys = async (
  model: ModelStatic<Model>,
  value = {},
) =>
  Object.fromEntries(
    (
      await Promise.all(
        Object.entries(model.associations)
          .filter(([mn, { foreignKey }]) => Object.hasOwn(value, foreignKey))
          .map(async ([modelName, { target, foreignKey }]) =>
            (await findAllIds(target, value[foreignKey])).length
              ? undefined
              : [foreignKey, value[foreignKey]],
          ),
      )
    ).filter((v) => v) as any,
  );

const findAllIds = (model, id) =>
  model
    .findAll({ where: id ? { id } : {}, attributes: ["id"] })
    .then((rows) => rows.map((o) => o.dataValues.id));

function extractColumnNames(sqlStatement) {
  const columns = sqlStatement.match(/\((.+?)\)/)[1].split(",");
  return columns.map((column) => column.replace(/`/g, ""));
}

export async function getSequelizeErrorData(
  e,
  { value = undefined, model = undefined } = {},
) {
  const associations =
    model && e instanceof ForeignKeyConstraintError
      ? await findMissingForeignKeys(model)
      : undefined;

  const { sql, name, message: m, original: { message: om } = {} } = e;
  return { sql, name, message: om ?? m, value, associations };
}
