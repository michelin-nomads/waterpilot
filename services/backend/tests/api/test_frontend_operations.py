"""Every GraphQL operation the web app ships must validate against the schema and fit
the server's depth, alias and token limits, so codegen never produces an operation
the API will reject at runtime."""

from __future__ import annotations

from pathlib import Path

import pytest
from graphql import (
    DocumentNode,
    FieldNode,
    FragmentDefinitionNode,
    FragmentSpreadNode,
    OperationDefinitionNode,
    parse,
    print_ast,
    specified_rules,
    validate,
    visit,
)
from graphql.language import Visitor
from strawberry.extensions.max_aliases import create_validator as alias_rule
from strawberry.extensions.query_depth_limiter import create_validator as depth_rule

from waterpilot.api.graphql.schema import MAX_ALIASES, MAX_DEPTH, MAX_TOKENS, build_schema

OPERATIONS_DIR = Path(__file__).resolve().parents[4] / "apps/web/src/graphql/operations"


def _document() -> DocumentNode:
    sources = sorted(OPERATIONS_DIR.glob("*.graphql"))
    assert sources, "no frontend operations found"
    return parse("\n".join(p.read_text(encoding="utf-8") for p in sources))


def _spreads(node: object) -> set[str]:
    names: set[str] = set()

    class Collect(Visitor):
        def enter_fragment_spread(self, spread: FragmentSpreadNode, *_args: object) -> None:
            names.add(spread.name.value)

    visit(node, Collect())  # type: ignore[arg-type]
    return names


def _standalone_operations() -> list[tuple[str, str]]:
    doc = _document()
    fragments = {d.name.value: d for d in doc.definitions if isinstance(d, FragmentDefinitionNode)}
    result: list[tuple[str, str]] = []
    for op in (d for d in doc.definitions if isinstance(d, OperationDefinitionNode)):
        needed: set[str] = set()
        pending = _spreads(op)
        while pending:
            name = pending.pop()
            if name not in needed:
                needed.add(name)
                pending |= _spreads(fragments[name])
        parts = [print_ast(op), *(print_ast(fragments[n]) for n in sorted(needed))]
        assert op.name is not None
        result.append((op.name.value, "\n".join(parts)))
    return result


OPERATIONS = _standalone_operations()


def test_frontend_covers_every_mutation() -> None:
    schema = build_schema(introspection=True)
    mutation_type = schema._schema.mutation_type
    assert mutation_type is not None
    used = {
        sel.name.value
        for _, source in OPERATIONS
        for definition in parse(source).definitions
        if isinstance(definition, OperationDefinitionNode)
        and definition.operation.value == "mutation"
        for sel in definition.selection_set.selections
        if isinstance(sel, FieldNode)
    }
    assert used == set(mutation_type.fields)


@pytest.mark.parametrize(("name", "source"), OPERATIONS, ids=[n for n, _ in OPERATIONS])
def test_operation_is_valid_and_within_limits(name: str, source: str) -> None:
    schema = build_schema(introspection=True)._schema
    document = parse(source, max_tokens=MAX_TOKENS)
    rules = [*specified_rules, depth_rule(MAX_DEPTH, None), alias_rule(MAX_ALIASES)]
    errors = validate(schema, document, rules)
    assert not errors, f"{name}: {[e.message for e in errors]}"
