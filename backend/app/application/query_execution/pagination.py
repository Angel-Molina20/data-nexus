import copy

from app.domain.query_model.ast import UniversalQuery


def paginate_query(
    document: UniversalQuery,
    page: int,
    page_size: int,
    max_rows: int,
) -> UniversalQuery:
    """Return a paginated AST copy without mutating the caller's document."""
    result = copy.deepcopy(document)
    logical_limit = result.query.limit
    window_offset = (page - 1) * page_size
    remaining = max_rows - window_offset
    if logical_limit is not None:
        remaining = min(remaining, max(0, logical_limit - window_offset))
    result.query.offset = (result.query.offset or 0) + window_offset
    result.query.limit = min(page_size + 1, max(0, remaining))
    return result
